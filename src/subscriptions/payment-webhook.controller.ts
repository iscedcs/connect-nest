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
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    if (signature && !provider.verifyWebhookSignature(rawBody, signature)) {
      this.logger.warn('Paystack webhook signature verification failed');
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = req.body;
    this.logger.log(`Paystack webhook event received: ${event?.event}`);

    const result = await provider.handleWebhookEvent(event);
    if (!result || !result.success) {
      return { status: 'ignored', message: 'Event not handled or non-actionable' };
    }

    // Check idempotency: avoid processing the same transaction twice
    const existingPayment = await this.db.paymentRecord.findFirst({
      where: { gatewayRef: result.reference },
    });

    if (existingPayment && existingPayment.status === 'success') {
      this.logger.log(`Payment already processed for reference ${result.reference}`);
      return { status: 'already_processed' };
    }

    // Upgrade the user's subscription
    try {
      const updatedSub = await this.subscriptionsService.upgradePlan(
        result.userId,
        result.planKey,
        result.reference,
      );

      // Record payment history
      await this.db.paymentRecord.create({
        data: {
          subscriptionId: updatedSub.id,
          amount: result.amountKobo,
          currency: 'NGN',
          status: 'success',
          gatewayRef: result.reference,
          paidAt: new Date(),
        },
      });

      // Dispatch notification to user
      await this.notifications.dispatch({
        userId: result.userId,
        type: 'SUBSCRIPTION_ACTIVATED',
        title: 'Subscription Activated! 🎉',
        message: `Your subscription to ${result.planKey} has been activated successfully.`,
        skipPush: false,
      });

      this.logger.log(
        `Successfully upgraded user ${result.userId} to ${result.planKey} via Paystack ref: ${result.reference}`,
      );

      return { status: 'success', userId: result.userId, planKey: result.planKey };
    } catch (err) {
      this.logger.error(`Error activating subscription after webhook: ${err.message}`);
      return { status: 'error', message: err.message };
    }
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
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    if (signature && !provider.verifyWebhookSignature(rawBody, signature)) {
      this.logger.warn('Paydestal webhook signature verification failed');
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = req.body;
    const result = await provider.handleWebhookEvent(event);
    if (!result || !result.success) {
      return { status: 'ignored' };
    }

    const existingPayment = await this.db.paymentRecord.findFirst({
      where: { gatewayRef: result.reference },
    });

    if (existingPayment && existingPayment.status === 'success') {
      return { status: 'already_processed' };
    }

    try {
      const updatedSub = await this.subscriptionsService.upgradePlan(
        result.userId,
        result.planKey,
        result.reference,
      );

      await this.db.paymentRecord.create({
        data: {
          subscriptionId: updatedSub.id,
          amount: result.amountKobo,
          currency: 'NGN',
          status: 'success',
          gatewayRef: result.reference,
          paidAt: new Date(),
        },
      });

      await this.notifications.dispatch({
        userId: result.userId,
        type: 'SUBSCRIPTION_ACTIVATED',
        title: 'Subscription Activated! 🎉',
        message: `Your subscription to ${result.planKey} has been activated successfully.`,
        skipPush: false,
      });

      return { status: 'success', userId: result.userId, planKey: result.planKey };
    } catch (err) {
      this.logger.error(`Error activating subscription via Paydestal: ${err.message}`);
      return { status: 'error', message: err.message };
    }
  }
}
