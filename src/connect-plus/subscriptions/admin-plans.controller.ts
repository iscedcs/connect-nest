import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { CpSubscriptionsService } from './subscriptions.service';
import { UpdateCpPlanDto } from './dto/admin-cp-plan.dto';
import { AdminOverrideSubscriptionDto } from './dto/admin-override-subscription.dto';
import { SuperAdminGuard } from '../../auth/guards/super-admin.guard';
import { CpSubscriptionPlan } from '../../generated/prisma/client';
import { PublicRoute } from '../../auth/decorators/public-route.decorator';

@ApiTags('Connect Plus - Admin Plans')
@Controller()
export class CpAdminPlansController {
  constructor(private readonly subscriptionsService: CpSubscriptionsService) {}

  @PublicRoute()
  @Get('cp/plans')
  @ApiOperation({ summary: 'Get all active Connect Plus subscription plans and quotas' })
  @ApiResponse({ status: 200, description: 'Active Connect Plus plans' })
  async getActivePlans() {
    const plans = await this.subscriptionsService.getAllPlansAdmin();
    const activePlans = plans.filter((p) => p.isActive);
    return {
      success: true,
      data: { plans: activePlans },
    };
  }

  @ApiBearerAuth('access-token')
  @UseGuards(SuperAdminGuard)
  @Get('admin/cp/plans')
  @ApiOperation({ summary: 'List all Connect Plus plans and quotas (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'All Connect Plus plans returned' })
  @ApiResponse({ status: 403, description: 'Super Admin access required' })
  async getAllPlansAdmin() {
    const plans = await this.subscriptionsService.getAllPlansAdmin();
    return {
      success: true,
      data: { plans },
    };
  }

  @ApiBearerAuth('access-token')
  @UseGuards(SuperAdminGuard)
  @Patch('admin/cp/plans/:planKey')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update Connect Plus plan pricing, active status, and resource quotas (Super Admin only)',
  })
  @ApiResponse({ status: 200, description: 'Connect Plus plan updated' })
  @ApiResponse({ status: 403, description: 'Super Admin access required' })
  async updatePlan(
    @Param('planKey') planKey: CpSubscriptionPlan,
    @Body() dto: UpdateCpPlanDto,
  ) {
    const plan = await this.subscriptionsService.adminUpdatePlan(planKey, dto);
    return {
      success: true,
      message: 'Connect Plus plan updated successfully',
      data: { plan },
    };
  }

  /**
   * Manually set an organization's subscription plan without requiring payment.
   * Use this for support overrides, gifted upgrades, or promotional access.
   * Every call is recorded in the audit log with the actor ID and reason.
   */
  @ApiBearerAuth('access-token')
  @UseGuards(SuperAdminGuard)
  @Post('admin/cp/organizations/:orgId/subscription/override')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Override an organization subscription plan without payment (Super Admin only)',
    description:
      'Immediately sets the organization to the specified plan with ACTIVE status. ' +
      'Use for support overrides, gifted upgrades, or promotions. ' +
      'All overrides are recorded in the audit log.',
  })
  @ApiParam({ name: 'orgId', description: 'The organization ID to override' })
  @ApiResponse({ status: 200, description: 'Subscription overridden successfully' })
  @ApiResponse({ status: 403, description: 'Super Admin access required' })
  async overrideSubscription(
    @Param('orgId') orgId: string,
    @Body() dto: AdminOverrideSubscriptionDto,
    @Req() req: Request,
  ) {
    const actorId = (req as any).isce_auth?.userId ?? 'unknown';
    const subscription = await this.subscriptionsService.adminOverrideSubscription(
      orgId,
      dto,
      actorId,
    );
    return {
      success: true,
      message: `Organization subscription overridden to ${dto.plan}`,
      data: { subscription },
    };
  }
}
