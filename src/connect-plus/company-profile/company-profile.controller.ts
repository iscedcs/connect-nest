import {
  Controller,
  Get,
  Put,
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
import { CpCompanyProfileService } from './company-profile.service';
import { CpContextGuard } from '../guards/cp-context.guard';
import { CpRolesGuard } from '../guards/cp-roles.guard';
import { CpRoles } from '../decorators/cp-roles.decorator';
import { CpContext } from '../decorators/cp-context.decorator';
import { CpRequestContext } from '../types/cp-request.types';
import { CpRole } from '../../generated/prisma/client';
import { UpsertCompanyProfileDto } from './dto/upsert-company-profile.dto';

@ApiTags('LYNCON Plus - Company Profile')
@ApiBearerAuth('access-token')
@UseGuards(CpContextGuard, CpRolesGuard)
@Controller('cp/company-profile')
export class CpCompanyProfileController {
  constructor(private readonly service: CpCompanyProfileService) {}

  @Get()
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.STAFF, CpRole.CREATOR)
  @ApiOperation({ summary: 'Get company profile' })
  @ApiResponse({ status: 200, description: 'Company profile' })
  get(@CpContext() ctx: CpRequestContext) {
    return this.service.get(ctx);
  }

  @Put()
  @CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.CREATOR)
  @ApiOperation({ summary: 'Upsert company profile' })
  @ApiResponse({ status: 200, description: 'Company profile saved' })
  upsert(
    @CpContext() ctx: CpRequestContext,
    
    @Body() dto: UpsertCompanyProfileDto,
    @Req() req: Request) {
    return this.service.upsert(ctx, dto, req);
  }
}
