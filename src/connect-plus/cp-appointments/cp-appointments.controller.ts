import {
  Controller,
  Get,
  Post,
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
import { CpAppointmentsService } from './cp-appointments.service';
import { CpContextGuard } from '../guards/cp-context.guard';
import { CpRolesGuard } from '../guards/cp-roles.guard';
import { CpRoles } from '../decorators/cp-roles.decorator';
import { CpContext } from '../decorators/cp-context.decorator';
import { CpRequestContext } from '../types/cp-request.types';
import { CpRole } from '../../generated/prisma/client';
import { CreateAppointmentDto } from './dto/create-cp-appointment.dto';
import { UpdateCpAppointmentDto } from './dto/update-cp-appointment.dto';
import { UpdateCpAppointmentStatusDto } from './dto/update-cp-appointment-status.dto';
import { PaginateQueryDto } from '../common/dto/paginate-query.dto';

@ApiTags('LYNCON Plus - Appointments')
@ApiBearerAuth('access-token')
@UseGuards(CpContextGuard, CpRolesGuard)
@Controller('cp/appointments')
export class CpAppointmentsController {
  constructor(private readonly service: CpAppointmentsService) {}

  @Get('me')
  @CpRoles(CpRole.CLIENT)
  @ApiOperation({ summary: 'Get my appointments (client)' })
  @ApiResponse({ status: 200, description: 'My appointments' })
  getMe(@CpContext() ctx: CpRequestContext) {
    return this.service.getMe(ctx);
  }

  @Post('me')
  @CpRoles(CpRole.CLIENT)
  @ApiOperation({ summary: 'Create appointment for myself (client)' })
  @ApiResponse({ status: 201, description: 'Appointment requested' })
  createForClient(
    @CpContext() ctx: CpRequestContext,
    @Body() dto: CreateAppointmentDto,
    @Req() req: Request,
  ) {
    return this.service.createForClient(ctx, dto, req);
  }

  @Patch('me/:id')
  @CpRoles(CpRole.CLIENT)
  @ApiOperation({ summary: 'Reschedule my appointment (client)' })
  @ApiResponse({ status: 200, description: 'Appointment rescheduled' })
  updateForClient(
    @CpContext() ctx: CpRequestContext,
    @Param('id') id: string,
    @Body() dto: UpdateCpAppointmentDto,
    @Req() req: Request,
  ) {
    return this.service.updateForClient(ctx, id, dto, req);
  }

  @Delete('me/:id')
  @CpRoles(CpRole.CLIENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel my appointment (client)' })
  @ApiResponse({ status: 200, description: 'Appointment cancelled' })
  cancelForClient(
    @CpContext() ctx: CpRequestContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.service.cancelForClient(ctx, id, req);
  }

  @Get('assigned')
  @CpRoles(CpRole.STAFF, CpRole.CREATOR)
  @ApiOperation({ summary: 'Get my assigned appointments (staff)' })
  @ApiResponse({ status: 200, description: 'Assigned appointments' })
  listAssigned(
    @CpContext() ctx: CpRequestContext,
    
    @Query() query: PaginateQueryDto) {
    return this.service.listAssigned(ctx, query);
  }

  @Get()
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.CREATOR)
  @ApiOperation({ summary: 'List all workspace appointments' })
  @ApiResponse({ status: 200, description: 'Appointment list' })
  list(
    @CpContext() ctx: CpRequestContext,
    
    @Query() query: PaginateQueryDto) {
    return this.service.list(ctx, query);
  }

  @Get(':id')
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.STAFF, CpRole.CREATOR)
  @ApiOperation({ summary: 'Get appointment detail' })
  @ApiResponse({ status: 200, description: 'Appointment detail' })
  findById(
    @CpContext() ctx: CpRequestContext,
    
    @Param('id') id: string) {
    return this.service.findById(ctx, id);
  }

  @Post()
  @CpRoles(CpRole.STAFF, CpRole.WORKSPACE_ADMIN, CpRole.CREATOR)
  @ApiOperation({ summary: 'Create appointment' })
  @ApiResponse({ status: 201, description: 'Appointment created' })
  create(
    @CpContext() ctx: CpRequestContext,
    
    @Body() dto: CreateAppointmentDto,
    @Req() req: Request) {
    return this.service.create(ctx, dto, req);
  }

  @Patch(':id/status')
  @CpRoles(CpRole.STAFF, CpRole.WORKSPACE_ADMIN, CpRole.CREATOR)
  @ApiOperation({ summary: 'Update appointment status' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  updateStatus(
    @CpContext() ctx: CpRequestContext,
    
    @Param('id') id: string,
    @Body() dto: UpdateCpAppointmentStatusDto,
    @Req() req: Request) {
    return this.service.updateStatus(ctx, id, dto, req);
  }

  @Patch(':id')
  @CpRoles(CpRole.STAFF, CpRole.WORKSPACE_ADMIN, CpRole.CREATOR)
  @ApiOperation({ summary: 'Update appointment details' })
  @ApiResponse({ status: 200, description: 'Appointment updated' })
  update(
    @CpContext() ctx: CpRequestContext,
    
    @Param('id') id: string,
    @Body() dto: UpdateCpAppointmentDto,
    @Req() req: Request) {
    return this.service.update(ctx, id, dto, req);
  }

  @Delete(':id')
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.CREATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel appointment' })
  @ApiResponse({ status: 200, description: 'Appointment cancelled' })
  cancel(
    @CpContext() ctx: CpRequestContext,
    
    @Param('id') id: string,
    @Req() req: Request) {
    return this.service.cancel(ctx, id, req);
  }
}
