import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CpSubscriptionsService } from './subscriptions.service';
import { CpContextGuard } from '../guards/cp-context.guard';
import { CpRolesGuard } from '../guards/cp-roles.guard';
import { CpRoles } from '../decorators/cp-roles.decorator';
import { CpContext } from '../decorators/cp-context.decorator';
import { CpRequestContext } from '../types/cp-request.types';
import { CpRole } from '../../generated/prisma/client';
import { UpgradePlanDto } from './dto/upgrade-plan.dto';

@ApiTags('Connect Plus - Subscriptions')
@ApiBearerAuth('access-token')
@UseGuards(CpContextGuard, CpRolesGuard)
@Controller('cp/organizations')
export class CpSubscriptionsController {
  constructor(private readonly service: CpSubscriptionsService) {}

  @Get('me/subscription')
  @CpRoles(CpRole.CREATOR)
  @ApiOperation({ summary: 'Get current organization subscription' })
  @ApiResponse({ status: 200, description: 'Subscription record' })
  get(@CpContext() ctx: CpRequestContext) {
    return this.service.getOrCreate(ctx);
  }

  @Post('me/subscription/upgrade')
  @CpRoles(CpRole.CREATOR)
  @ApiOperation({ summary: 'Upgrade or change subscription plan' })
  @ApiResponse({ status: 200, description: 'Subscription updated' })
  upgrade(@CpContext() ctx: CpRequestContext, @Body() dto: UpgradePlanDto) {
    return this.service.upgrade(ctx, dto);
  }
}
