import {
  Body,
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { PublicRoute } from '../auth/decorators/public-route.decorator';
import { InternalGuard } from '../internal/internal.guard';
import {
  ForwardedPaystackEventDto,
  WalletPaymentDeliveryDto,
} from './dto/subscription.dto';
import { PaymentGatewayFactory } from './gateways/payment-gateway.factory';
import { WebhookResult } from './gateways/payment-gateway.interface';
import { CHECKOUT_KINDS, CheckoutKind } from './subscriptions.service';
import {
  ActivationOutcome,
  SubscriptionPaymentsService,
} from './subscription-payments.service';
import { PlanTier } from '../generated/prisma/client';

@ApiTags('Subscriptions Webhooks')
@Controller('subscriptions/webhooks')
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);

  constructor(
    private readonly gatewayFactory: PaymentGatewayFactory,
    private readonly payments: SubscriptionPaymentsService,
  ) {}

  @Post('paystack')
  @PublicRoute()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Paystack payment webhooks' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handlePaystackWebhook(
    @Req() req: Request,
    @Headers('x-paystack-signature') signature: string,
  ) {
    const provider = this.gatewayFactory.getProvider('PAYSTACK');
    const rawBody = this.getRawBody(req);

    if (!signature || !provider.verifyWebhookSignature(rawBody, signature)) {
      this.logger.warn('Paystack webhook signature verification failed');
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = req.body;
    this.logger.log(`Paystack webhook event received: ${event?.event}`);

    const result = await provider.handleWebhookEvent(event);
    if (!result || !result.success) {
      return {
        status: 'ignored',
        message: 'Event not handled or non-actionable',
      };
    }

    return this.payments.activateFromPayment(result, 'Paystack');
  }

  @Post('paydestal')
  @PublicRoute()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Paydestal payment webhooks' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handlePaydestalWebhook(
    @Req() req: Request,
    @Headers('x-paydestal-signature') signature: string,
  ) {
    const provider = this.gatewayFactory.getProvider('PAYDESTAL');
    const rawBody = this.getRawBody(req);

    if (!signature || !provider.verifyWebhookSignature(rawBody, signature)) {
      this.logger.warn('Paydestal webhook signature verification failed');
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = req.body;
    const result = await provider.handleWebhookEvent(event);
    if (!result || !result.success) {
      return { status: 'ignored' };
    }

    return this.payments.activateFromPayment(result, 'Paydestal');
  }

  /**
   * Paystack delivers every webhook to wallet-nest (one URL per account), which
   * forwards charges tagged service=connect here as { event, data }. wallet-nest
   * has already checked Paystack's signature; this route trusts the internal
   * secret. A non-2xx makes wallet-nest record the webhook as FAILED, so an
   * underpaid or unappliable payment stays visible instead of looking handled.
   */
  @Post('internal/paystack-event')
  @PublicRoute()
  @UseGuards(InternalGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Internal] Apply a Paystack charge forwarded by wallet-nest',
  })
  @ApiResponse({
    status: 200,
    description: 'Applied, already applied, or ignored',
  })
  @ApiResponse({
    status: 403,
    description: 'Invalid or missing internal secret',
  })
  async handleForwardedPaystackEvent(@Body() body: ForwardedPaystackEventDto) {
    const provider = this.gatewayFactory.getProvider('PAYSTACK');
    const result = await provider.handleWebhookEvent({
      event: body.event,
      data: body.data,
    });
    if (!result || !result.success) {
      return { status: 'ignored' };
    }
    // wallet-nest saved the card this checkout asked it to keep, and sends
    // its id and label next to the event (never the card's token).
    if (body.savedCard) result.savedCard = body.savedCard;

    return PaymentWebhookController.answer(
      await this.payments.activateFromPayment(
        result,
        'Paystack via wallet-nest',
      ),
    );
  }

  /**
   * wallet-nest delivers a payment the user made from their Fiscus wallet
   * (approved with their PIN) or took under their wallet mandate. The same
   * checks as a card payment apply. A 422 makes wallet-nest move the money
   * back to the wallet; a 5xx makes it retry.
   */
  @Post('internal/wallet-payment')
  @PublicRoute()
  @UseGuards(InternalGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Internal] Apply a wallet payment delivered by wallet-nest',
  })
  @ApiResponse({ status: 200, description: 'Applied or already applied' })
  @ApiResponse({
    status: 403,
    description: 'Invalid or missing internal secret',
  })
  @ApiResponse({
    status: 422,
    description: 'The payment no longer applies; wallet-nest returns the money',
  })
  async handleWalletPayment(@Body() body: WalletPaymentDeliveryDto) {
    const metadata = body.metadata ?? {};
    const kind = metadata.checkoutKind as CheckoutKind;
    const planKey = metadata.planKey as PlanTier;
    if (!Object.values(PlanTier).includes(planKey)) {
      throw new UnprocessableEntityException('The payment names no plan');
    }
    const result: WebhookResult = {
      success: true,
      userId: body.userId,
      planKey,
      reference: body.reference,
      amountKobo: body.amountKobo,
      checkoutKind: CHECKOUT_KINDS.includes(kind) ? kind : 'full',
      fromPlanKey: metadata.fromPlanKey as PlanTier | undefined,
      pricedPeriodEnd: (metadata.anchor ?? metadata.renewsAt) as
        string | undefined,
      autoRenew: metadata.autoRenew === true,
      paymentMethod: 'WALLET',
      walletMandateId: body.mandateId ?? null,
    };
    return PaymentWebhookController.answer(
      await this.payments.activateFromPayment(result, 'Wallet'),
    );
  }

  /** Internal callers learn the outcome from the status code. */
  private static answer(outcome: ActivationOutcome) {
    if (
      outcome.status === 'success' ||
      outcome.status === 'already_processed'
    ) {
      return outcome;
    }
    if (outcome.status === 'rejected') {
      throw new UnprocessableEntityException(outcome.message);
    }
    throw new InternalServerErrorException(
      outcome.message ?? 'Subscription could not be activated',
    );
  }

  /**
   * The gateway signs the exact bytes it sent. Re-serialising a parsed body is not
   * guaranteed to reproduce them (key order, whitespace, unicode escapes), so a
   * missing rawBody means we cannot verify anything — fail rather than guess.
   */
  private getRawBody(req: Request): string | Buffer {
    const rawBody = (req as Request & { rawBody?: string | Buffer }).rawBody;
    if (!rawBody) {
      this.logger.error(
        'Webhook received without rawBody — NestFactory must be created with { rawBody: true }',
      );
      throw new BadRequestException('Unable to verify webhook payload');
    }
    return rawBody;
  }
}
