import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
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
} from '@nestjs/swagger';
import { Request } from 'express';
import { CpLeadsService } from './leads.service';
import { CpContextGuard } from '../guards/cp-context.guard';
import { CpRolesGuard } from '../guards/cp-roles.guard';
import { CpRoles } from '../decorators/cp-roles.decorator';
import { CpContext } from '../decorators/cp-context.decorator';
import { CpRequestContext } from '../types/cp-request.types';
import { CpRole } from '../../generated/prisma/client';
import { ListLeadsQueryDto } from './dto/list-leads-query.dto';
import { AssignLeadDto } from './dto/assign-lead.dto';
import { RejectLeadDto } from './dto/reject-lead.dto';

@ApiTags('Connect Plus - Leads')
@ApiBearerAuth('access-token')
@UseGuards(CpContextGuard, CpRolesGuard)
@Controller('cp/leads')
export class CpLeadsController {
  constructor(private readonly service: CpLeadsService) {}

  @Get()
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.STAFF, CpRole.CREATOR)
  @ApiOperation({ summary: 'List leads' })
  @ApiResponse({ status: 200, description: 'Lead list' })
  list(
    @CpContext() ctx: CpRequestContext,
    
    @Query() query: ListLeadsQueryDto) {
    return this.service.list(ctx, query);
  }

  @Get(':leadId')
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.STAFF, CpRole.CREATOR)
  @ApiOperation({ summary: 'Get lead detail' })
  @ApiResponse({ status: 200, description: 'Lead detail' })
  findById(
    @CpContext() ctx: CpRequestContext,
    
    @Param('leadId') leadId: string) {
    return this.service.findById(ctx, leadId);
  }

  @Patch(':leadId/assign')
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.CREATOR)
  @ApiOperation({ summary: 'Assign lead to staff' })
  @ApiResponse({ status: 200, description: 'Lead assigned' })
  assign(
    @CpContext() ctx: CpRequestContext,
    
    @Param('leadId') leadId: string,
    @Body() dto: AssignLeadDto,
    @Req() req: Request) {
    return this.service.assign(ctx, leadId, dto, req);
  }

  @Patch(':leadId/validate')
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.STAFF, CpRole.CREATOR)
  @ApiOperation({ summary: 'Convert lead to client (BL-2)' })
  @ApiResponse({ status: 200, description: 'Lead converted to client' })
  validate(
    @CpContext() ctx: CpRequestContext,
    
    @Param('leadId') leadId: string,
    @Req() req: Request) {
    return this.service.validate(ctx, leadId, req);
  }

  @Patch(':leadId/reject')
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.STAFF, CpRole.CREATOR)
  @ApiOperation({ summary: 'Reject lead' })
  @ApiResponse({ status: 200, description: 'Lead rejected' })
  reject(
    @CpContext() ctx: CpRequestContext,
    
    @Param('leadId') leadId: string,
    @Body() dto: RejectLeadDto,
    @Req() req: Request) {
    return this.service.reject(ctx, leadId, dto, req);
  }

  @Delete(':leadId')
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.CREATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete lead' })
  @ApiResponse({ status: 200, description: 'Lead deleted' })
  remove(
    @CpContext() ctx: CpRequestContext,
    
    @Param('leadId') leadId: string,
    @Req() req: Request) {
    return this.service.remove(ctx, leadId, req);
  }
}
