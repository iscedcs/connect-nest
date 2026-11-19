import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ParseEnumPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { SelectPlanDto, InitiatePaymentDto } from './dto/subscription.dto';
import { UpdatePlanWithLimitsDto } from './dto/admin-plan.dto';
import { BroadcastLaunchDto } from './dto/broadcast-launch.dto';
import { PublicRoute } from '../auth/decorators/public-route.decorator';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { PlanTier } from '../generated/prisma/client';
import { PaymentGatewayFactory } from './gateways/payment-gateway.factory';
import { SystemConfigService } from '../system-config/system-config.service';
import { SubscriptionBroadcastService } from './subscription-broadcast.service';
import { SubscriptionPaymentsService } from './subscription-payments.service';
import { WalletNestClient } from './gateways/wallet-nest.client';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly gatewayFactory: PaymentGatewayFactory,
    private readonly systemConfigService: SystemConfigService,
    private readonly broadcastService: SubscriptionBroadcastService,
    private readonly payments: SubscriptionPaymentsService,
    private readonly wallet: WalletNestClient,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user subscription and plan details' })
  @ApiResponse({ status: 200, description: 'Subscription details returned' })
  @ApiResponse({ status: 404, description: 'No subscription found' })
  async getMySubscription(@Req() req: any) {
    const user = req.user || req.isce_auth;
    const sub = await this.subscriptionsService.getActiveSubscription(user.id);
    return {
      success: true,
      data: this.subscriptionsService.buildSubscriptionResponse(sub, {
        trialEligible: await this.subscriptionsService.isTrialEligible(sub),
      }),
    };
  }

  @Get('plans')
  @PublicRoute()
  @ApiOperation({ summary: 'List all available subscription plans' })
  @ApiResponse({ status: 200, description: 'Plans returned' })
  async getPlans() {
    const plans = await this.subscriptionsService.getActivePlans();
    return { success: true, data: { plans } };
  }

  @Get('limits')
  @ApiOperation({ summary: 'Get effective plan limits for the current user' })
  @ApiResponse({ status: 200, description: 'Limits returned' })
  async getMyLimits(@Req() req: any) {
    const user = req.user || req.isce_auth;
    const limits = await this.subscriptionsService.getUserLimits(user.id);
    return { success: true, data: { limits } };
  }

  @Post('select-plan')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Select a plan (starts trial for paid plans)' })
  @ApiResponse({
    status: 200,
    description: 'Plan selected, subscription created',
  })
  @ApiResponse({ status: 409, description: 'User already has a subscription' })
  async selectPlan(@Req() req: any, @Body() dto: SelectPlanDto) {
    if (dto.planKey !== 'FREE') {
      const isEnabled =
        await this.systemConfigService.isPersonalSubscriptionEnabled();
      if (!isEnabled) {
        throw new ForbiddenException(
          'Paid subscriptions are currently disabled by the system administrator',
        );
      }
    }

    const user = req.user || req.isce_auth;
    const sub = await this.subscriptionsService.createSubscription(
      user.id,
      dto.planKey,
    );
    return {
      success: true,
      message:
        dto.planKey === 'FREE'
          ? 'Free plan activated'
          : 'Trial started — enjoy 6 months of full access',
      data: { subscriptionId: sub.id, status: sub.status },
    };
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel the current paid subscription' })
  @ApiResponse({ status: 200, description: 'Subscription cancelled' })
  @ApiResponse({ status: 404, description: 'No subscription found' })
  async cancelSubscription(@Req() req: any) {
    const user = req.user || req.isce_auth;
    const sub = await this.subscriptionsService.cancelSubscription(user.id);
    // Nothing will be charged again: forget the saved card, revoke the
    // wallet permission.
    await this.payments.stopAutoRenew(user.id);
    return {
      success: true,
      message:
        'Subscription cancelled. You will retain access until the end of your current billing period.',
      data: { status: sub.status, cancelledAt: sub.cancelledAt },
    };
  }

  @Post('initiate-payment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate a payment session to upgrade plan' })
  @ApiResponse({ status: 200, description: 'Payment session created' })
  @ApiResponse({
    status: 409,
    description:
      'Already on this plan with more than 7 days left; renewing opens 7 days before it ends',
  })
  async initiatePayment(@Req() req: any, @Body() dto: InitiatePaymentDto) {
    const isEnabled =
      await this.systemConfigService.isPersonalSubscriptionEnabled();
    if (!isEnabled) {
      throw new ForbiddenException(
        'Paid subscriptions and payment checkout are currently disabled by the system administrator',
      );
    }

    const user = req.user || req.isce_auth;
    const plan = await this.subscriptionsService.getPlanByKey(dto.planKey);
    if (!plan || !plan.isActive) {
      throw new NotFoundException(`Plan ${dto.planKey} is not available`);
    }

    if (plan.priceMonthly === 0) {
      throw new BadRequestException('FREE plan does not require payment');
    }

    // Price the checkout. 409 for the plan the user already has outside the
    // renewal window (a double payment) or a cheaper plan with paid time
    // left; a mid-cycle upgrade is charged only the prorated difference, and
    // a first paid plan starts with a trial.
    const sub = await this.subscriptionsService.getActiveSubscription(user.id);
    const quote = this.subscriptionsService.quoteCheckout(
      sub,
      plan,
      new Date(),
      { trialEligible: await this.subscriptionsService.isTrialEligible(sub) },
    );
    // A trial exists to be followed by automatic payment.
    const autoRenew = quote.kind === 'trial' ? true : (dto.autoRenew ?? true);

    // What the payment carries back to activation, whichever way it's paid.
    const metadata: Record<string, unknown> = {
      checkoutKind: quote.kind,
      autoRenew,
      ...(quote.kind === 'prorated_upgrade' && {
        fromPlanKey: quote.fromPlanKey,
        renewsAt: quote.renewsAt.toISOString(),
      }),
    };
    const priced = {
      planKey: dto.planKey,
      amountKobo: quote.amountKobo,
      fullPriceKobo: quote.fullPriceKobo,
      kind: quote.kind,
      renewsAt: quote.renewsAt,
      autoRenew,
    };

    if (dto.method === 'WALLET') {
      const payment = await this.wallet.createWalletPayment({
        userId: user.id,
        amountKobo: quote.amountKobo,
        reference: `SUBW_${dto.planKey}_${user.id}_${Date.now()}`,
        description:
          quote.kind === 'trial'
            ? `Connect ${plan.name} trial start`
            : `Connect ${plan.name} plan`,
        metadata: { userId: user.id, planKey: dto.planKey, ...metadata },
        // Renewals charge the full monthly price.
        ...(autoRenew && { mandateMaxAmountKobo: plan.priceMonthly }),
      });
      return {
        success: true,
        message: 'Wallet payment created; approve it with your wallet PIN',
        data: {
          ...priced,
          method: 'WALLET',
          walletPaymentId: payment.id,
          balanceSufficient: payment.balanceSufficient,
        },
      };
    }

    const provider = this.gatewayFactory.getProvider(dto.gateway);
    if (quote.kind !== 'full' && provider.providerName !== 'PAYSTACK') {
      // Only the Paystack path carries the checkout metadata activation
      // relies on to tell a prorated or trial payment from an underpaid one.
      throw new BadRequestException(
        'Upgrades and trials are only available with Paystack',
      );
    }

    const result = await provider.initiateCheckout({
      userId: user.id,
      email: user.email || `${user.id}@isce.app`,
      planKey: dto.planKey,
      amountKobo: quote.amountKobo,
      callbackUrl: dto.callbackUrl,
      metadata,
      saveCard: autoRenew,
    });

    return {
      success: true,
      message: 'Payment checkout session initialized',
      data: {
        ...result,
        ...priced,
        method: 'CARD',
        provider: provider.providerName,
      },
    };
  }

  @Get('quote/:planKey')
  @ApiOperation({
    summary:
      'What paying for a plan would charge now, before starting a checkout',
    description:
      'A mid-cycle move to a dearer plan is prorated: it charges the difference ' +
      'for the rest of the current period and keeps the renewal date. Anything ' +
      'else is one month at the full price.',
  })
  @ApiResponse({ status: 200, description: 'Quote returned' })
  @ApiResponse({ status: 400, description: 'The Free plan needs no payment' })
  @ApiResponse({ status: 404, description: 'Plan not available' })
  @ApiResponse({
    status: 409,
    description:
      'Same plan outside the renewal window, or a cheaper plan while paid time is left',
  })
  async quote(
    @Req() req: any,
    @Param('planKey', new ParseEnumPipe(PlanTier)) planKey: PlanTier,
  ) {
    const plan = await this.subscriptionsService.getPlanByKey(planKey);
    if (!plan || !plan.isActive) {
      throw new NotFoundException(`Plan ${planKey} is not available`);
    }
    if (plan.priceMonthly === 0) {
      throw new BadRequestException('FREE plan does not require payment');
    }
    const user = req.user || req.isce_auth;
    const sub = await this.subscriptionsService.getActiveSubscription(user.id);
    return {
      success: true,
      data: this.subscriptionsService.quoteCheckout(sub, plan, new Date(), {
        trialEligible: await this.subscriptionsService.isTrialEligible(sub),
      }),
    };
  }

  // ─── Admin ───────────────────────────────────────────────────────────────

  @Get('admin/plans')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({
    summary: 'List all subscription plans with limits (Super Admin only)',
  })
  @ApiResponse({ status: 200, description: 'All plans returned with limits' })
  @ApiResponse({ status: 403, description: 'Super Admin access required' })
  async getAllPlansAdmin() {
    const plans = await this.subscriptionsService.getAllPlansAdmin();
    return {
      success: true,
      data: { plans },
    };
  }

  @Patch('admin/plans/:planKey')
  @UseGuards(SuperAdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Update plan pricing, status, and feature limits (Super Admin only)',
  })
  @ApiResponse({ status: 200, description: 'Plan updated' })
  @ApiResponse({ status: 403, description: 'Super Admin access required' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async updatePlan(
    @Param('planKey') planKey: string,
    @Body() dto: UpdatePlanWithLimitsDto,
  ) {
    const plan = await this.subscriptionsService.updatePlanDetails(
      planKey as PlanTier,
      dto,
    );
    return {
      success: true,
      message: 'Plan updated successfully',
      data: { plan },
    };
  }

  @Post('admin/broadcast-launch')
  @UseGuards(SuperAdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Broadcast LYNCON 6-month free trial launch announcement (email + in-app) to existing users (Super Admin only)',
  })
  @ApiResponse({ status: 200, description: 'Broadcast executed or simulated' })
  @ApiResponse({ status: 403, description: 'Super Admin access required' })
  async broadcastLaunch(@Body() dto: BroadcastLaunchDto) {
    const summary =
      await this.broadcastService.broadcastLaunchAnnouncement(dto);
    return {
      success: true,
      message: dto.dryRun
        ? 'Dry run completed — no emails dispatched or subscriptions altered'
        : 'Subscription launch broadcast completed successfully',
      data: summary,
    };
  }
}
