import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { PaymentWebhookController } from './payment-webhook.controller';
import { DatabaseModule } from '../database/database.module';
import { NotificationModule } from '../notification/notification.module';
import { AuthModule } from '../auth/auth.module';
import { PlanLimitGuard } from './guards/plan-limit.guard';
import { PaystackGatewayProvider } from './gateways/paystack.provider';
import { PaydestalGatewayProvider } from './gateways/paydestal.provider';
import { PaymentGatewayFactory } from './gateways/payment-gateway.factory';
import { SubscriptionBroadcastService } from './subscription-broadcast.service';
import { SubscriptionPaymentsService } from './subscription-payments.service';
import { SubscriptionRenewalService } from './subscription-renewal.service';
import { WalletNestClient } from './gateways/wallet-nest.client';

@Module({
  imports: [DatabaseModule, NotificationModule, AuthModule],
  controllers: [SubscriptionsController, PaymentWebhookController],
  providers: [
    SubscriptionsService,
    SubscriptionPaymentsService,
    SubscriptionRenewalService,
    WalletNestClient,
    SubscriptionBroadcastService,
    PlanLimitGuard,
    PaystackGatewayProvider,
    PaydestalGatewayProvider,
    PaymentGatewayFactory,
  ],
  exports: [
    SubscriptionsService,
    SubscriptionBroadcastService,
    PlanLimitGuard,
    PaymentGatewayFactory,
    PaystackGatewayProvider,
    PaydestalGatewayProvider,
  ],
})
export class SubscriptionsModule {}
