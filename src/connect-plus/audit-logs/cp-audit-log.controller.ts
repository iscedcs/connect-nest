import { Controller, Get, Query, UseGuards, Header } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CpAuditLogService } from './cp-audit-log.service';
import { CpContextGuard } from '../guards/cp-context.guard';
import { CpRolesGuard } from '../guards/cp-roles.guard';
import { CpRoles } from '../decorators/cp-roles.decorator';
import { CpContext } from '../decorators/cp-context.decorator';
import { CpRequestContext } from '../types/cp-request.types';
import { CpRole } from '../../generated/prisma/client';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

@ApiTags('Connect Plus - Audit Logs')
@ApiBearerAuth('access-token')
@UseGuards(CpContextGuard, CpRolesGuard)
@Controller('cp/workspaces/:wsId/audit-logs')
export class CpAuditLogController {
  constructor(private readonly service: CpAuditLogService) {}

  @Get()
  @CpRoles(CpRole.WORKSPACE_ADMIN)
  @ApiOperation({
    summary: 'List workspace audit logs (paginated, filterable)',
  })
  @ApiResponse({ status: 200, description: 'Paginated audit log entries' })
  list(
    @CpContext() ctx: CpRequestContext,
    @Query() query: ListAuditLogsQueryDto,
  ) {
    return this.service.list(ctx, query);
  }

  @Get('export')
  @CpRoles(CpRole.WORKSPACE_ADMIN)
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="audit-logs.csv"')
  @ApiOperation({ summary: 'Export workspace audit logs as CSV' })
  @ApiResponse({ status: 200, description: 'CSV file of audit logs' })
  async exportCsv(
    @CpContext() ctx: CpRequestContext,
    @Query() query: ListAuditLogsQueryDto,
  ): Promise<string> {
    return this.service.exportCsv(ctx, query);
  }

  @Get('verify')
  @CpRoles(CpRole.WORKSPACE_ADMIN)
  @ApiOperation({ summary: 'Verify hash-chain integrity of audit logs' })
  @ApiResponse({ status: 200, description: 'Chain verification result' })
  verifyChain(@CpContext() ctx: CpRequestContext) {
    return this.service.verifyChain(ctx);
  }
}
