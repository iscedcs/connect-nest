import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { SelectPlanDto, InitiatePaymentDto } from './dto/subscription.dto';
import { PublicRoute } from '../auth/decorators/public-route.decorator';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user subscription and plan details' })
  @ApiResponse({ status: 200, description: 'Subscription details returned' })
  @ApiResponse({ status: 404, description: 'No subscription found' })
  async getMySubscription(@Req() req: any) {
    const sub = await this.subscriptionsService.getActiveSubscription(
      req.user.id,
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
    const limits = await this.subscriptionsService.getUserLimits(req.user.id);
    return { success: true, data: { limits } };
  }

  @Post('select-plan')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Select a plan (starts trial for paid plans)' })
  @ApiResponse({ status: 200, description: 'Plan selected, subscription created' })
  @ApiResponse({ status: 409, description: 'User already has a subscription' })
  async selectPlan(@Req() req: any, @Body() dto: SelectPlanDto) {
    const sub = await this.subscriptionsService.createSubscription(
      req.user.id,
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
    const sub = await this.subscriptionsService.cancelSubscription(req.user.id);
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
    // Paydestal payment initiation — implemented in Phase 7
    // Placeholder returns a structured stub response
    return {
      success: false,
      message: 'Payment gateway integration pending',
      data: { planKey: dto.planKey, userId: req.user.id },
    };
  }
}
