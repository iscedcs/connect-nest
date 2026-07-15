import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { CpAnalyticsService } from './analytics.service';
import { CpContextGuard } from '../guards/cp-context.guard';
import { CpRolesGuard } from '../guards/cp-roles.guard';
import { CpRoles } from '../decorators/cp-roles.decorator';
import { CpContext } from '../decorators/cp-context.decorator';
import { CpRequestContext } from '../types/cp-request.types';
import { CpRole } from '../../generated/prisma/client';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@ApiTags('Connect Plus - Analytics')
@ApiBearerAuth('access-token')
@UseGuards(CpContextGuard, CpRolesGuard)
@Controller('cp/analytics')
export class CpAnalyticsController {
  constructor(private readonly service: CpAnalyticsService) {}

  @Get('attendance')
  @CpRoles(CpRole.WORKSPACE_ADMIN)
  @ApiOperation({ summary: 'Attendance summary for workspace' })
  @ApiResponse({ status: 200, description: 'Attendance analytics' })
  getAttendance(
    @CpContext() ctx: CpRequestContext,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.service.getAttendanceSummary(ctx, query);
  }

  @Get('clients')
  @CpRoles(CpRole.WORKSPACE_ADMIN)
  @ApiOperation({ summary: 'Client engagement metrics for workspace' })
  @ApiResponse({ status: 200, description: 'Client analytics' })
  getClients(
    @CpContext() ctx: CpRequestContext,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.service.getClientMetrics(ctx, query);
  }

  @Get('invoices')
  @CpRoles(CpRole.WORKSPACE_ADMIN)
  @ApiOperation({ summary: 'Revenue and invoice stats for workspace' })
  @ApiResponse({ status: 200, description: 'Invoice analytics' })
  getInvoices(
    @CpContext() ctx: CpRequestContext,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.service.getInvoiceStats(ctx, query);
  }

  @Get('staff/:staffId')
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.STAFF)
  @ApiOperation({
    summary: 'Individual staff metrics (STAFF can only view self)',
  })
  @ApiResponse({ status: 200, description: 'Staff analytics' })
  @ApiParam({ name: 'staffId', description: 'Staff Profile ID' })
  getStaff(
    @CpContext() ctx: CpRequestContext,
    @Param('staffId') staffId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.service.getStaffMetrics(ctx, staffId, query);
  }
}
