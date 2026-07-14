import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
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
import { CpStaffService } from './staff.service';
import { CpContextGuard } from '../guards/cp-context.guard';
import { CpRolesGuard } from '../guards/cp-roles.guard';
import { CpRoles } from '../decorators/cp-roles.decorator';
import { CpContext } from '../decorators/cp-context.decorator';
import { CpRequestContext } from '../types/cp-request.types';
import { CpRole } from '../../generated/prisma/client';
import { InviteStaffDto } from './dto/invite-staff.dto';
import { UpdateStaffProfileDto } from './dto/update-staff-profile.dto';
import { UpdateStaffStatusDto } from './dto/update-staff-status.dto';
import { UpdateStaffRoleDto } from './dto/update-staff-role.dto';
import { PaginateQueryDto } from '../common/dto/paginate-query.dto';

@ApiTags('Connect Plus - Staff')
@ApiBearerAuth('access-token')
@UseGuards(CpContextGuard, CpRolesGuard)
@Controller('cp/workspaces/:wsId/staff')
export class CpStaffController {
  constructor(private readonly service: CpStaffService) {}

  @Post('invite')
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.CREATOR)
  @ApiOperation({ summary: 'Invite staff member' })
  @ApiResponse({ status: 201, description: 'Staff invitation sent' })
  inviteStaff(
    @CpContext() ctx: CpRequestContext,
    @Param('wsId') _wsId: string,
    @Body() dto: InviteStaffDto,
    @Req() req: Request,
  ) {
    return this.service.inviteStaff(ctx, dto, req);
  }

  @Get('invites')
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.CREATOR)
  @ApiOperation({ summary: 'List workspace invites' })
  @ApiResponse({ status: 200, description: 'Invite list' })
  listInvites(
    @CpContext() ctx: CpRequestContext,
    @Param('wsId') _wsId: string,
  ) {
    return this.service.listInvites(ctx);
  }

  @Get()
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.CREATOR)
  @ApiOperation({ summary: 'List staff members' })
  @ApiResponse({ status: 200, description: 'Staff list' })
  listStaff(
    @CpContext() ctx: CpRequestContext,
    @Param('wsId') _wsId: string,
    @Query() query: PaginateQueryDto,
  ) {
    return this.service.listStaff(ctx, query);
  }

  @Get(':staffId')
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.STAFF, CpRole.CREATOR)
  @ApiOperation({ summary: 'Get staff profile' })
  @ApiResponse({ status: 200, description: 'Staff profile' })
  getStaff(
    @CpContext() ctx: CpRequestContext,
    @Param('wsId') _wsId: string,
    @Param('staffId') staffId: string,
  ) {
    return this.service.getStaff(ctx, staffId);
  }

  @Patch(':staffId')
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.CREATOR)
  @ApiOperation({ summary: 'Update staff profile' })
  @ApiResponse({ status: 200, description: 'Staff profile updated' })
  updateStaff(
    @CpContext() ctx: CpRequestContext,
    @Param('wsId') _wsId: string,
    @Param('staffId') staffId: string,
    @Body() dto: UpdateStaffProfileDto,
    @Req() req: Request,
  ) {
    return this.service.updateStaff(ctx, staffId, dto, req);
  }

  @Patch(':staffId/status')
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.CREATOR)
  @ApiOperation({ summary: 'Update staff status' })
  @ApiResponse({ status: 200, description: 'Staff status updated' })
  updateStaffStatus(
    @CpContext() ctx: CpRequestContext,
    @Param('wsId') _wsId: string,
    @Param('staffId') staffId: string,
    @Body() dto: UpdateStaffStatusDto,
    @Req() req: Request,
  ) {
    return this.service.updateStaffStatus(ctx, staffId, dto, req);
  }

  @Patch(':staffId/role')
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.CREATOR)
  @ApiOperation({ summary: 'Update staff role' })
  @ApiResponse({ status: 200, description: 'Staff role updated' })
  updateStaffRole(
    @CpContext() ctx: CpRequestContext,
    @Param('wsId') _wsId: string,
    @Param('staffId') staffId: string,
    @Body() dto: UpdateStaffRoleDto,
    @Req() req: Request,
  ) {
    return this.service.updateStaffRole(ctx, staffId, dto, req);
  }
}
