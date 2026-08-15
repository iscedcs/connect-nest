import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CpSubscriptionsService } from './subscriptions.service';
import { UpdateCpPlanDto } from './dto/admin-cp-plan.dto';
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
}
