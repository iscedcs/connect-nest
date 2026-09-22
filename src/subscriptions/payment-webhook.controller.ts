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
import { ForwardedPaystackEventDto } from './dto/subscription.dto';
import { PaymentGatewayFactory } from './gateways/payment-gateway.factory';
import { WebhookResult } from './gateways/payment-gateway.interface';
import { SubscriptionsService } from './subscriptions.service';
import { DatabaseService } from '../database/database.service';
import { NotificationDispatcher } from '../notification/notification-dispatcher.service';
import { Plan, Prisma } from '../generated/prisma/client';

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
      return {
        status: 'ignored',
        message: 'Event not handled or non-actionable',
      };
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

    const outcome = await this.activateFromPayment(
      result,
      'Paystack via wallet-nest',
    );
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
      this.logger.error(
        `${gateway} webhook referenced unknown plan: ${result.planKey}`,
      );
      return { status: 'error', message: 'Unknown plan' };
    }

    // A prorated upgrade only paid the difference for the rest of the period,
    // so it is checked against what is due when it lands (inside the
    // transaction below); every other payment must cover a full month.
    const prorated = result.checkoutKind === 'prorated_upgrade';
    if (!prorated && (result.amountKobo ?? 0) < plan.priceMonthly) {
      this.logger.warn(
        `${gateway} webhook underpaid for ${result.planKey}: paid ${result.amountKobo}, expected ${plan.priceMonthly} (ref: ${result.reference})`,
      );
      return {
        status: 'rejected',
        message: 'Amount does not cover plan price',
      };
    }

    try {
      // Idempotency is enforced by the unique index on gatewayRef rather than a
      // read-then-write check — gateways retry, and two concurrent deliveries would
      // both pass a findFirst. Both writes share one transaction so a duplicate
      // reference rolls the upgrade back instead of extending the period again.
      const refusal = await this.db.$transaction(async (tx) => {
        if (prorated) {
          const outcome = await this.checkProratedUpgrade(
            tx,
            result,
            plan,
            gateway,
          );
          if (outcome) return outcome;
        }

        const updatedSub = prorated
          ? await this.subscriptionsService.upgradePlan(
              result.userId,
              result.planKey,
              result.reference,
              tx,
              { keepCurrentPeriod: true },
            )
          : await this.subscriptionsService.upgradePlan(
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
        return null;
      });
      if (refusal) return refusal;

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

      return {
        status: 'success',
        userId: result.userId,
        planKey: result.planKey,
      };
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
        this.logger.log(
          `Payment already processed for reference ${result.reference}`,
        );
        return { status: 'already_processed' };
      }
      this.logger.error(
        `Error activating subscription after ${gateway} webhook: ${err.message}`,
      );
      return { status: 'error', message: err.message };
    }
  }

  /**
   * Decide, inside the activation transaction, whether a prorated upgrade
   * payment can be applied. Returns an outcome to stop with, or null to go on.
   *
   * The amount due is recomputed now, from the subscription as it stands:
   * the payment was priced at checkout, and the subscription may have moved
   * since (a second upgrade paid in another tab, a renewal, a lapse). What
   * was paid must still cover the difference for the time now left, which is
   * never more than what was quoted unless the subscription itself changed.
   */
  private async checkProratedUpgrade(
    tx: Prisma.TransactionClient,
    result: WebhookResult,
    plan: Plan,
    gateway: string,
  ): Promise<{ status: string; message?: string } | null> {
    // Serialise activations for this user: two upgrade payments landing
    // together must not both pass the check below.
    await tx.$queryRaw`SELECT id FROM "Subscription" WHERE "userId" = ${result.userId} FOR UPDATE`;

    // A redelivery of an upgrade already applied. By now the user is on the
    // new plan, so the re-quote below would wrongly refuse it.
    const seen = await tx.paymentRecord.findUnique({
      where: { gatewayRef: result.reference },
    });
    if (seen) {
      this.logger.log(
        `Payment already processed for reference ${result.reference}`,
      );
      return { status: 'already_processed' };
    }

    const sub = await tx.subscription.findUnique({
      where: { userId: result.userId },
      include: { plan: true },
    });
    const due = sub
      ? this.subscriptionsService.prorationQuote(sub, plan)
      : null;

    if (!due || due.fromPlanKey !== result.fromPlanKey) {
      this.logger.error(
        `REFUND NEEDED: ${gateway} prorated upgrade to ${result.planKey} no longer applies ` +
          `(user ${result.userId}, now on ${sub?.plan.key ?? 'no plan'} / ${sub?.status ?? '-'}, ` +
          `priced from ${result.fromPlanKey}; paid ${result.amountKobo}, ref: ${result.reference})`,
      );
      return {
        status: 'rejected',
        message:
          'The subscription changed after this upgrade was priced; the payment needs a refund',
      };
    }

    if ((result.amountKobo ?? 0) < due.amountKobo) {
      this.logger.warn(
        `${gateway} prorated upgrade underpaid for ${result.planKey}: paid ${result.amountKobo}, due ${due.amountKobo} (ref: ${result.reference})`,
      );
      return {
        status: 'rejected',
        message: 'Amount does not cover the prorated upgrade',
      };
    }
    return null;
  }
}
