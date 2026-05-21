import {
  Controller,
  Get,
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
import { CpClientsService } from './clients.service';
import { CpContextGuard } from '../guards/cp-context.guard';
import { CpRolesGuard } from '../guards/cp-roles.guard';
import { CpRoles } from '../decorators/cp-roles.decorator';
import { CpContext } from '../decorators/cp-context.decorator';
import { CpRequestContext } from '../types/cp-request.types';
import { CpRole } from '../../generated/prisma/client';
import { AssignClientDto } from './dto/assign-client.dto';
import { PaginateQueryDto } from '../common/dto/paginate-query.dto';

@ApiTags('Connect Plus - Clients')
@ApiBearerAuth('access-token')
@UseGuards(CpContextGuard, CpRolesGuard)
@Controller('cp/workspaces/:wsId/clients')
export class CpClientsController {
  constructor(private readonly service: CpClientsService) {}

  @Get('me')
  @CpRoles(CpRole.CLIENT)
  @ApiOperation({ summary: 'Get my client profile' })
  @ApiResponse({ status: 200, description: 'My client profile' })
  getMe(
    @CpContext() ctx: CpRequestContext,
    @Param('wsId') _wsId: string,
  ) {
    return this.service.getMe(ctx);
  }

  @Get('assigned')
  @CpRoles(CpRole.STAFF, CpRole.CREATOR)
  @ApiOperation({ summary: 'List my assigned clients' })
  @ApiResponse({ status: 200, description: 'Assigned client list' })
  listAssigned(
    @CpContext() ctx: CpRequestContext,
    @Param('wsId') _wsId: string,
    @Query() query: PaginateQueryDto,
  ) {
    return this.service.listAssigned(ctx, query);
  }

  @Get()
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.CREATOR)
  @ApiOperation({ summary: 'List all clients' })
  @ApiResponse({ status: 200, description: 'Client list' })
  list(
    @CpContext() ctx: CpRequestContext,
    @Param('wsId') _wsId: string,
    @Query() query: PaginateQueryDto,
  ) {
    return this.service.list(ctx, query);
  }

  @Get(':clientId')
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.STAFF, CpRole.CREATOR)
  @ApiOperation({ summary: 'Get client detail' })
  @ApiResponse({ status: 200, description: 'Client detail' })
  findById(
    @CpContext() ctx: CpRequestContext,
    @Param('wsId') _wsId: string,
    @Param('clientId') clientId: string,
  ) {
    return this.service.findById(ctx, clientId);
  }

  @Patch(':clientId/assign')
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.CREATOR)
  @ApiOperation({ summary: 'Reassign client to different staff' })
  @ApiResponse({ status: 200, description: 'Client reassigned' })
  assign(
    @CpContext() ctx: CpRequestContext,
    @Param('wsId') _wsId: string,
    @Param('clientId') clientId: string,
    @Body() dto: AssignClientDto,
    @Req() req: Request,
  ) {
    return this.service.assign(ctx, clientId, dto, req);
  }
}

