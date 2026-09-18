import { Controller, Get, Post, UseGuards, HttpCode, HttpStatus, GoneException } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CpSubscriptionsService } from './subscriptions.service';
import { CpContextGuard } from '../guards/cp-context.guard';
import { CpRolesGuard } from '../guards/cp-roles.guard';
import { CpRoles } from '../decorators/cp-roles.decorator';
import { CpContext } from '../decorators/cp-context.decorator';
import { CpRequestContext } from '../types/cp-request.types';
import { CpRole } from '../../generated/prisma/client';

@ApiTags('LYNCON Plus - Subscriptions')
@ApiBearerAuth('access-token')
@UseGuards(CpContextGuard, CpRolesGuard)
@Controller('cp/organizations')
export class CpSubscriptionsController {
  constructor(private readonly service: CpSubscriptionsService) {}

  @Get('me/subscription')
  @CpRoles(CpRole.CREATOR)
  @ApiOperation({ summary: 'Get current organization subscription' })
  @ApiResponse({ status: 200, description: 'Subscription record' })
  get(@CpContext() ctx: CpRequestContext) {
    return this.service.getOrCreate(ctx);
  }

  /**
   * This endpoint has been intentionally removed.
   * Plan upgrades are handled exclusively via Paystack payment webhooks.
   * Initiate payment on the client side using Paystack's JS SDK;
   * the subscription activates automatically once payment is verified.
   */
  @Post('me/subscription/upgrade')
  @CpRoles(CpRole.CREATOR)
  @HttpCode(HttpStatus.GONE)
  @ApiOperation({
    summary: '[REMOVED] Use Paystack payment flow to upgrade',
    deprecated: true,
  })
  @ApiResponse({
    status: 410,
    description: 'Endpoint removed — upgrades happen via verified Paystack webhook',
  })
  upgrade() {
    throw new GoneException(
      'This endpoint has been removed. Initiate payment through Paystack; ' +
      'your subscription will activate automatically once payment is verified.',
    );
  }
}
