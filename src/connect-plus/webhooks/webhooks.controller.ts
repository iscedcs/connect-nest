import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { CpWebhooksService } from './webhooks.service';
import { InviteAcceptedWebhookDto } from './dto/invite-accepted-webhook.dto';
import { PublicRoute } from '../../auth/decorators/public-route.decorator';
import { verifyWebhookSignature } from '../utils/hmac';

@ApiTags('Connect Plus - Webhooks')
@Controller('cp/webhooks')
export class CpWebhooksController {
  constructor(private readonly service: CpWebhooksService) {}

  @Post('invite-accepted')
  @PublicRoute()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle invite accepted webhook from isce-auth' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async inviteAccepted(
    @Body() dto: InviteAcceptedWebhookDto,
    @Req() req: Request,
  ) {
    const signature = req.headers['x-webhook-signature'] as string | undefined;
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

    if (!signature || !rawBody) {
      throw new UnauthorizedException('Missing signature or raw body');
    }

    verifyWebhookSignature(
      rawBody,
      signature,
      process.env.AUTH_INVITE_WEBHOOK_SECRET!,
    );

    await this.service.handleInviteAccepted(dto);
    return { ok: true };
  }

  @Post('paystack')
  @PublicRoute()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Paystack payment webhook events' })
  @ApiResponse({ status: 200, description: 'Event processed' })
  async paystackWebhook(
    @Headers('x-paystack-signature') signature: string,
    @Req() req: Request,
  ) {
    const rawBody =
      (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.alloc(0);
    await this.service.handlePaystackEvent(signature ?? '', rawBody);
    return { ok: true };
  }
}
