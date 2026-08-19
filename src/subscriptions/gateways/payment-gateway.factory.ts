import { Injectable, Logger } from '@nestjs/common';
import { PaymentGatewayProvider } from './payment-gateway.interface';
import { PaystackGatewayProvider } from './paystack.provider';
import { PaydestalGatewayProvider } from './paydestal.provider';

@Injectable()
export class PaymentGatewayFactory {
  private readonly logger = new Logger(PaymentGatewayFactory.name);

  constructor(
    private readonly paystackProvider: PaystackGatewayProvider,
    private readonly paydestalProvider: PaydestalGatewayProvider,
  ) {}

  getProvider(providerName?: string): PaymentGatewayProvider {
    const selected = (providerName || process.env.DEFAULT_PAYMENT_GATEWAY || 'PAYSTACK').toUpperCase();

    if (selected === 'PAYDESTAL') {
      return this.paydestalProvider;
    }

    if (selected === 'PAYSTACK') {
      return this.paystackProvider;
    }

    this.logger.warn(`Unknown gateway provider '${selected}', falling back to Paystack`);
    return this.paystackProvider;
  }
}
