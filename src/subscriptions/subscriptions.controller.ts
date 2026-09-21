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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { SelectPlanDto, InitiatePaymentDto } from './dto/subscription.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { UpdatePlanWithLimitsDto } from './dto/admin-plan.dto';
import { BroadcastLaunchDto } from './dto/broadcast-launch.dto';
import { PublicRoute } from '../auth/decorators/public-route.decorator';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { PlanTier } from '../generated/prisma/client';
import { PaymentGatewayFactory } from './gateways/payment-gateway.factory';
import { SystemConfigService } from '../system-config/system-config.service';
import { SubscriptionBroadcastService } from './subscription-broadcast.service';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly gatewayFactory: PaymentGatewayFactory,
    private readonly systemConfigService: SystemConfigService,
    private readonly broadcastService: SubscriptionBroadcastService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user subscription and plan details' })
  @ApiResponse({ status: 200, description: 'Subscription details returned' })
  @ApiResponse({ status: 404, description: 'No subscription found' })
  async getMySubscription(@Req() req: any) {
    const user = req.user || req.isce_auth;
    const sub = await this.subscriptionsService.getActiveSubscription(
      user.id,
    );
    return {
      success: true,
      data: this.subscriptionsService.buildSubscriptionResponse(sub),
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
  @ApiResponse({ status: 200, description: 'Plan selected, subscription created' })
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
          : 'Trial started — enjoy 3 months of full access',
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

    const provider = this.gatewayFactory.getProvider(dto.gateway);
    const result = await provider.initiateCheckout({
      userId: user.id,
      email: user.email || `${user.id}@isce.app`,
      planKey: dto.planKey,
      amountKobo: plan.priceMonthly,
      callbackUrl: dto.callbackUrl,
    });

    return {
      success: true,
      message: 'Payment checkout session initialized',
      data: {
        ...result,
        planKey: dto.planKey,
        amountKobo: plan.priceMonthly,
        provider: provider.providerName,
      },
    };
  }

  // ─── Admin ───────────────────────────────────────────────────────────────

  @Get('admin/plans')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'List all subscription plans with limits (Super Admin only)' })
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
  @ApiOperation({ summary: 'Update plan pricing, status, and feature limits (Super Admin only)' })
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
