import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CpAttendanceService } from './attendance.service';
import { CpContextGuard } from '../guards/cp-context.guard';
import { CpRolesGuard } from '../guards/cp-roles.guard';
import { CpRoles } from '../decorators/cp-roles.decorator';
import { CpContext } from '../decorators/cp-context.decorator';
import { CpRequestContext } from '../types/cp-request.types';
import { CpRole } from '../../generated/prisma/client';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { ListAttendanceQueryDto } from './dto/list-attendance-query.dto';
import { OverrideAttendanceDto } from './dto/override-attendance.dto';
import { Request } from 'express';

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(CpContextGuard, CpRolesGuard)
@Controller('cp/workspaces/:wsId/attendance')
export class CpAttendanceController {
  constructor(private readonly service: CpAttendanceService) {}

  @Post('check-in')
  @CpRoles(CpRole.STAFF)
  @ApiOperation({ summary: 'Check in for today' })
  checkIn(
    @CpContext() ctx: CpRequestContext,
    @Body() dto: CheckInDto,
    @Req() req: Request,
  ) {
    return this.service.checkIn(ctx, dto, req);
  }

  @Post('check-out')
  @CpRoles(CpRole.STAFF)
  @ApiOperation({ summary: 'Check out for today' })
  checkOut(
    @CpContext() ctx: CpRequestContext,
    @Body() dto: CheckOutDto,
    @Req() req: Request,
  ) {
    return this.service.checkOut(ctx, dto, req);
  }

  @Get('me')
  @CpRoles(CpRole.STAFF)
  @ApiOperation({ summary: 'My attendance history' })
  getMe(
    @CpContext() ctx: CpRequestContext,
    @Query() query: ListAttendanceQueryDto,
  ) {
    return this.service.getMyAttendance(ctx, query);
  }

  @Get()
  @CpRoles(CpRole.WORKSPACE_ADMIN)
  @ApiOperation({ summary: 'All staff attendance' })
  listAll(
    @CpContext() ctx: CpRequestContext,
    @Query() query: ListAttendanceQueryDto,
  ) {
    return this.service.listAll(ctx, query);
  }

  @Get(':staffId')
  @CpRoles(CpRole.WORKSPACE_ADMIN)
  @ApiOperation({ summary: 'One staff member attendance' })
  getByStaff(
    @CpContext() ctx: CpRequestContext,
    @Param('staffId') staffId: string,
    @Query() query: ListAttendanceQueryDto,
  ) {
    return this.service.getStaffAttendance(ctx, staffId, query);
  }

  @Patch(':recordId/override')
  @CpRoles(CpRole.WORKSPACE_ADMIN)
  @ApiOperation({ summary: 'Override attendance record' })
  override(
    @CpContext() ctx: CpRequestContext,
    @Param('recordId') recordId: string,
    @Body() dto: OverrideAttendanceDto,
    @Req() req: Request,
  ) {
    return this.service.override(ctx, recordId, dto, req);
  }
}
