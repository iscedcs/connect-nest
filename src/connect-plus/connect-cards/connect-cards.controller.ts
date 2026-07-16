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
import { Throttle } from '@nestjs/throttler';
import { CpConnectCardsService } from './connect-cards.service';
import { CpContextGuard } from '../guards/cp-context.guard';
import { CpRolesGuard } from '../guards/cp-roles.guard';
import { CpRoles } from '../decorators/cp-roles.decorator';
import { CpContext } from '../decorators/cp-context.decorator';
import { CpRequestContext } from '../types/cp-request.types';
import { CpRole } from '../../generated/prisma/client';
import { CreateCardDto } from './dto/create-card.dto';
import { PairCardDto } from './dto/pair-card.dto';
import { UpdateCardConfigDto } from './dto/update-card-config.dto';
import { UpdateCardStatusDto } from './dto/update-card-status.dto';
import { ListCardsQueryDto } from './dto/list-cards-query.dto';
import { TapCardDto } from './dto/tap-card.dto';
import { AnalyticsQueryDto } from '../analytics/dto/analytics-query.dto';
import { Request } from 'express';
import { PublicRoute } from '../../auth/decorators/public-route.decorator';

@ApiTags('Connect Cards')
@ApiBearerAuth()
@UseGuards(CpContextGuard, CpRolesGuard)
@Controller('cp/staff/cards')
export class CpConnectCardsController {
  constructor(private readonly service: CpConnectCardsService) {}

  @Post()
  @CpRoles(CpRole.WORKSPACE_ADMIN)
  @ApiOperation({ summary: 'Add card to inventory' })
  create(
    @CpContext() ctx: CpRequestContext,
    @Body() dto: CreateCardDto,
    @Req() req: Request) {
    return this.service.create(ctx, dto, req);
  }

  @Patch(':cardId/pair')
  @CpRoles(CpRole.WORKSPACE_ADMIN)
  @ApiOperation({ summary: 'Pair card to staff' })
  pair(
    @CpContext() ctx: CpRequestContext,
    @Param('cardId') cardId: string,
    @Body() dto: PairCardDto,
    @Req() req: Request) {
    return this.service.pair(ctx, cardId, dto, req);
  }

  @Patch(':cardId/unpair')
  @CpRoles(CpRole.WORKSPACE_ADMIN)
  @ApiOperation({ summary: 'Unpair card' })
  unpair(
    @CpContext() ctx: CpRequestContext,
    @Param('cardId') cardId: string,
    @Req() req: Request) {
    return this.service.unpair(ctx, cardId, req);
  }

  @Patch(':cardId/config')
  @CpRoles(CpRole.WORKSPACE_ADMIN)
  @ApiOperation({ summary: 'Update tap page config' })
  updateConfig(
    @CpContext() ctx: CpRequestContext,
    @Param('cardId') cardId: string,
    @Body() dto: UpdateCardConfigDto,
    @Req() req: Request) {
    return this.service.updateConfig(ctx, cardId, dto, req);
  }

  @Patch(':cardId/status')
  @CpRoles(CpRole.WORKSPACE_ADMIN)
  @ApiOperation({ summary: 'Update card status' })
  updateStatus(
    @CpContext() ctx: CpRequestContext,
    @Param('cardId') cardId: string,
    @Body() dto: UpdateCardStatusDto,
    @Req() req: Request) {
    return this.service.updateStatus(ctx, cardId, dto, req);
  }

  @Get()
  @CpRoles(CpRole.WORKSPACE_ADMIN)
  @ApiOperation({ summary: 'List all cards in workspace' })
  list(@CpContext() ctx: CpRequestContext, @Query() query: ListCardsQueryDto) {
    return this.service.list(ctx, query);
  }

  @Get('analytics')
  @CpRoles(CpRole.WORKSPACE_ADMIN)
  @ApiOperation({ summary: 'Advanced card tap analytics for workspace' })
  getAnalytics(
    @CpContext() ctx: CpRequestContext,
    @Query() query: AnalyticsQueryDto) {
    return this.service.getAnalytics(ctx, query);
  }
}

// ─── Public tap endpoint ──────────────────────────────────────────
@ApiTags('Connect Cards (Public)')
@Controller('cp/public/cards')
export class CpPublicCardTapController {
  constructor(private readonly service: CpConnectCardsService) {}

  @Post(':cardCode/tap')
  @PublicRoute()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Public card tap' })
  tap(
    @Param('cardCode') cardCode: string,
    @Body() dto: TapCardDto,
    @Req() req: Request) {
    return this.service.tap(cardCode, dto, req);
  }
}
