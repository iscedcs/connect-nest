import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { Request } from 'express';
import { CpInvitesService } from './invites.service';
import { CpContextGuard } from '../guards/cp-context.guard';
import { CpRolesGuard } from '../guards/cp-roles.guard';
import { CpRoles } from '../decorators/cp-roles.decorator';
import { CpContext } from '../decorators/cp-context.decorator';
import { CpRequestContext } from '../types/cp-request.types';
import { CpRole } from '../../generated/prisma/client';
import { SendInviteDto } from './dto';

@ApiTags('LYNCON Plus - Invites')
@ApiBearerAuth('access-token')
@ApiHeader({
  name: 'x-workspace-id',
  description: 'Workspace ID',
  required: true,
})
@UseGuards(CpContextGuard, CpRolesGuard)
@Controller('cp/invites')
export class CpInvitesController {
  constructor(private readonly service: CpInvitesService) {}

  @Post()
  @CpRoles(CpRole.WORKSPACE_ADMIN)
  @ApiOperation({ summary: 'Send a staff invite' })
  @ApiResponse({ status: 201, description: 'Invitation sent' })
  sendInvite(
    @CpContext() ctx: CpRequestContext,
    @Body() dto: SendInviteDto,
    @Req() req: Request,
  ) {
    return this.service.sendInvite(ctx, dto, req);
  }

  @Get()
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.CREATOR)
  @ApiOperation({ summary: 'List workspace invites' })
  @ApiResponse({ status: 200, description: 'Invite list' })
  listInvites(@CpContext() ctx: CpRequestContext) {
    return this.service.listInvites(ctx);
  }

  @Get(':inviteId')
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.CREATOR)
  @ApiOperation({ summary: 'Get invite details' })
  @ApiResponse({ status: 200, description: 'Invite details' })
  getInvite(
    @CpContext() ctx: CpRequestContext,
    @Param('inviteId') inviteId: string,
  ) {
    return this.service.getInvite(ctx, inviteId);
  }

  @Post(':inviteId/resend')
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.CREATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend a pending or expired invite' })
  @ApiResponse({ status: 200, description: 'Invite resent' })
  resendInvite(
    @CpContext() ctx: CpRequestContext,
    @Param('inviteId') inviteId: string,
    @Req() req: Request,
  ) {
    return this.service.resendInvite(ctx, inviteId, req);
  }

  @Delete(':inviteId')
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.CREATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a pending invite' })
  @ApiResponse({ status: 200, description: 'Invite revoked' })
  revokeInvite(
    @CpContext() ctx: CpRequestContext,
    @Param('inviteId') inviteId: string,
    @Req() req: Request,
  ) {
    return this.service.revokeInvite(ctx, inviteId, req);
  }
}

