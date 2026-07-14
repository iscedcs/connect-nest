import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { CpWorkspacesService } from './workspaces.service';
import { CpContextGuard } from '../guards/cp-context.guard';
import { CpRolesGuard } from '../guards/cp-roles.guard';
import { CpRoles } from '../decorators/cp-roles.decorator';
import { CpContext } from '../decorators/cp-context.decorator';
import { CpRequestContext } from '../types/cp-request.types';
import { CpRole } from '../../generated/prisma/client';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { UpdateWorkspaceStatusDto } from './dto/update-workspace-status.dto';
import { InviteAdminDto } from './dto/invite-admin.dto';

@ApiTags('Connect Plus - Workspaces')
@ApiBearerAuth('access-token')
@UseGuards(CpContextGuard, CpRolesGuard)
@Controller('cp/workspaces')
export class CpWorkspacesController {
  constructor(private readonly service: CpWorkspacesService) {}

  @Post()
  @CpRoles(CpRole.CREATOR)
  @ApiOperation({ summary: 'Create workspace' })
  @ApiResponse({ status: 201, description: 'Workspace created' })
  create(
    @CpContext() ctx: CpRequestContext,
    @Body() dto: CreateWorkspaceDto,
    @Req() req: Request,
  ) {
    return this.service.create(ctx, dto, req);
  }

  @Get()
  @CpRoles(CpRole.CREATOR)
  @ApiOperation({ summary: 'List all organization workspaces' })
  @ApiResponse({ status: 200, description: 'Workspace list' })
  list(@CpContext() ctx: CpRequestContext) {
    return this.service.list(ctx);
  }

  @Get(':id')
  @CpRoles(CpRole.CREATOR, CpRole.WORKSPACE_ADMIN)
  @ApiOperation({ summary: 'Get workspace detail' })
  @ApiResponse({ status: 200, description: 'Workspace detail' })
  findById(@CpContext() ctx: CpRequestContext, @Param('id') id: string) {
    return this.service.findById(ctx, id);
  }

  @Patch(':id')
  @CpRoles(CpRole.CREATOR, CpRole.WORKSPACE_ADMIN)
  @ApiOperation({ summary: 'Update workspace' })
  @ApiResponse({ status: 200, description: 'Workspace updated' })
  update(
    @CpContext() ctx: CpRequestContext,
    @Param('id') id: string,
    @Body() dto: UpdateWorkspaceDto,
    @Req() req: Request,
  ) {
    return this.service.update(ctx, id, dto, req);
  }

  @Patch(':id/status')
  @CpRoles(CpRole.CREATOR)
  @ApiOperation({ summary: 'Update workspace status' })
  @ApiResponse({ status: 200, description: 'Workspace status updated' })
  updateStatus(
    @CpContext() ctx: CpRequestContext,
    @Param('id') id: string,
    @Body() dto: UpdateWorkspaceStatusDto,
    @Req() req: Request,
  ) {
    return this.service.updateStatus(ctx, id, dto, req);
  }

  @Post(':id/invite-admin')
  @CpRoles(CpRole.CREATOR)
  @ApiOperation({ summary: 'Invite workspace admin' })
  @ApiResponse({ status: 201, description: 'Invitation sent' })
  inviteAdmin(
    @CpContext() ctx: CpRequestContext,
    @Param('id') id: string,
    @Body() dto: InviteAdminDto,
    @Req() req: Request,
  ) {
    return this.service.inviteAdmin(ctx, id, dto, req);
  }
}

// ─── Standalone: my workspaces (no CpContextGuard) ──────────────────────────
@ApiTags('Connect Plus - Workspaces')
@ApiBearerAuth('access-token')
@Controller('cp')
export class CpMyWorkspacesController {
  constructor(private readonly service: CpWorkspacesService) {}

  @Get('my-workspaces')
  @ApiOperation({
    summary: 'List all workspaces the authenticated user belongs to',
  })
  @ApiResponse({ status: 200, description: 'Workspace memberships' })
  myWorkspaces(@Req() req: Request) {
    const authUserId = (req as Request & { isce_auth?: { id: string } })
      .isce_auth?.id;
    return this.service.getMyWorkspaces(authUserId ?? '');
  }
}
