import { Controller, Get, Patch, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CpNotificationsService } from './notifications.service';
import { CpContextGuard } from '../guards/cp-context.guard';
import { CpRolesGuard } from '../guards/cp-roles.guard';
import { CpRoles } from '../decorators/cp-roles.decorator';
import { CpContext } from '../decorators/cp-context.decorator';
import { CpRequestContext } from '../types/cp-request.types';
import { CpRole } from '../../generated/prisma/client';

@ApiTags('Connect Plus - Notifications')
@ApiBearerAuth('access-token')
@UseGuards(CpContextGuard, CpRolesGuard)
@Controller('cp/workspaces/:wsId/notifications')
export class CpNotificationsController {
  constructor(private readonly service: CpNotificationsService) {}

  @Get()
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.STAFF, CpRole.CLIENT, CpRole.CREATOR)
  @ApiOperation({ summary: 'List my notifications' })
  @ApiResponse({ status: 200, description: 'Notification list' })
  list(
    @CpContext() ctx: CpRequestContext,
    @Param('wsId') _wsId: string,
  ) {
    return this.service.list(ctx);
  }

  @Patch('read-all')
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.STAFF, CpRole.CLIENT, CpRole.CREATOR)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All marked read' })
  markAllRead(
    @CpContext() ctx: CpRequestContext,
    @Param('wsId') _wsId: string,
  ) {
    return this.service.markAllRead(ctx);
  }

  @Patch(':id/read')
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.STAFF, CpRole.CLIENT, CpRole.CREATOR)
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({ status: 200, description: 'Marked read' })
  markRead(
    @CpContext() ctx: CpRequestContext,
    @Param('wsId') _wsId: string,
    @Param('id') id: string,
  ) {
    return this.service.markRead(ctx, id);
  }
}
