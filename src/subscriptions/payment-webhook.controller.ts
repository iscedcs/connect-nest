import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { PublicRoute } from '../auth/decorators/public-route.decorator';
import { PaymentGatewayFactory } from './gateways/payment-gateway.factory';
import { WebhookResult } from './gateways/payment-gateway.interface';
import { SubscriptionsService } from './subscriptions.service';
import { DatabaseService } from '../database/database.service';
import { NotificationDispatcher } from '../notification/notification-dispatcher.service';

@ApiTags('Subscriptions Webhooks')
@Controller('subscriptions/webhooks')
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);

  constructor(
    private readonly gatewayFactory: PaymentGatewayFactory,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly db: DatabaseService,
    private readonly notifications: NotificationDispatcher,
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
      return { status: 'ignored', message: 'Event not handled or non-actionable' };
    }

    return this.activateFromPayment(result, 'Paystack');
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

    return this.activateFromPayment(result, 'Paydestal');
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

  /**
   * Shared activation path for every gateway. Both webhook handlers funnel through
   * here so the amount and idempotency checks can never drift between providers.
   */
  private async activateFromPayment(result: WebhookResult, gateway: string) {
    // Trust the signature for authenticity, but still confirm the customer actually
    // paid for the plan the metadata is asking us to grant.
    const plan = await this.db.plan.findUnique({
      where: { key: result.planKey },
    });
    if (!plan) {
      this.logger.error(`${gateway} webhook referenced unknown plan: ${result.planKey}`);
      return { status: 'error', message: 'Unknown plan' };
    }

    if ((result.amountKobo ?? 0) < plan.priceMonthly) {
      this.logger.warn(
        `${gateway} webhook underpaid for ${result.planKey}: paid ${result.amountKobo}, expected ${plan.priceMonthly} (ref: ${result.reference})`,
      );
      return { status: 'rejected', message: 'Amount does not cover plan price' };
    }

    try {
      // Idempotency is enforced by the unique index on gatewayRef rather than a
      // read-then-write check — gateways retry, and two concurrent deliveries would
      // both pass a findFirst. Both writes share one transaction so a duplicate
      // reference rolls the upgrade back instead of extending the period again.
      await this.db.$transaction(async (tx) => {
        const updatedSub = await this.subscriptionsService.upgradePlan(
          result.userId,
          result.planKey,
          result.reference,
          tx,
        );

        await tx.paymentRecord.create({
          data: {
            subscriptionId: updatedSub.id,
            amount: result.amountKobo,
            currency: 'NGN',
            status: 'success',
            gatewayRef: result.reference,
            paidAt: new Date(),
          },
        });
      });

      await this.notifications.dispatch({
        userId: result.userId,
        type: 'SUBSCRIPTION_ACTIVATED',
        title: 'Subscription Activated! 🎉',
        message: `Your subscription to ${result.planKey} has been activated successfully.`,
        skipPush: false,
      });

      this.logger.log(
        `Successfully upgraded user ${result.userId} to ${result.planKey} via ${gateway} ref: ${result.reference}`,
      );

      return { status: 'success', userId: result.userId, planKey: result.planKey };
    } catch (err) {
      // Scoped to the gatewayRef index specifically: a unique violation on any other
      // column (e.g. userId while bootstrapping a subscription) is a real error, and
      // reporting it as already-processed would silently swallow a genuine payment.
      const target = err?.meta?.target;
      const isDuplicateRef =
        err?.code === 'P2002' &&
        (Array.isArray(target)
          ? target.includes('gatewayRef')
          : String(target ?? '').includes('gatewayRef'));

      if (isDuplicateRef) {
        this.logger.log(`Payment already processed for reference ${result.reference}`);
        return { status: 'already_processed' };
      }
      this.logger.error(
        `Error activating subscription after ${gateway} webhook: ${err.message}`,
      );
      return { status: 'error', message: err.message };
    }
  }
}
