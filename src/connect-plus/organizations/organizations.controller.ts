import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Req,
  Query,
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
import { CpOrganizationsService } from './organizations.service';
import { CpContextGuard } from '../guards/cp-context.guard';
import { CpRolesGuard } from '../guards/cp-roles.guard';
import { CpRoles } from '../decorators/cp-roles.decorator';
import { CpContext } from '../decorators/cp-context.decorator';
import { CpRequestContext } from '../types/cp-request.types';
import { CpRole } from '../../generated/prisma/client';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { CpAnalyticsService } from '../analytics/analytics.service';
import { AnalyticsQueryDto } from '../analytics/dto/analytics-query.dto';

@ApiTags('Connect Plus - Organizations')
@ApiBearerAuth('access-token')
@UseGuards(CpContextGuard, CpRolesGuard)
@Controller('cp/organizations')
export class CpOrganizationsController {
  constructor(
    private readonly service: CpOrganizationsService,
    private readonly analyticsService: CpAnalyticsService,
  ) {}

  @Post()
  @CpRoles(CpRole.CREATOR)
  @ApiOperation({ summary: 'Create organization' })
  @ApiResponse({ status: 201, description: 'Organization created' })
  @ApiResponse({ status: 409, description: 'Organization already exists' })
  create(
    @CpContext() ctx: CpRequestContext,
    @Body() dto: CreateOrganizationDto,
    @Req() req: Request,
  ) {
    return this.service.create(ctx, dto, req);
  }

  @Get('me')
  @CpRoles(CpRole.CREATOR)
  @ApiOperation({ summary: 'Get my organization' })
  @ApiResponse({ status: 200, description: 'Organization detail' })
  getMyOrg(@CpContext() ctx: CpRequestContext) {
    return this.service.getMyOrg(ctx);
  }

  @Patch('me')
  @CpRoles(CpRole.CREATOR)
  @ApiOperation({ summary: 'Update organization' })
  @ApiResponse({ status: 200, description: 'Organization updated' })
  update(
    @CpContext() ctx: CpRequestContext,
    @Body() dto: UpdateOrganizationDto,
    @Req() req: Request,
  ) {
    return this.service.update(ctx, dto, req);
  }

  @Delete('me')
  @CpRoles(CpRole.CREATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive organization' })
  @ApiResponse({ status: 200, description: 'Organization archived' })
  archive(@CpContext() ctx: CpRequestContext, @Req() req: Request) {
    return this.service.archive(ctx, req);
  }

  @Get('me/analytics')
  @CpRoles(CpRole.CREATOR)
  @ApiOperation({ summary: 'Aggregated org analytics (no client PII)' })
  @ApiResponse({ status: 200, description: 'Organisation-level analytics' })
  getOrgAnalytics(
    @CpContext() ctx: CpRequestContext,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getOrgAnalytics(ctx, query);
  }
}
