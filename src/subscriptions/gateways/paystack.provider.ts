import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  PaymentGatewayProvider,
  InitiateCheckoutParams,
  CheckoutResult,
  WebhookResult,
} from './payment-gateway.interface';
import { PlanTier } from '../../generated/prisma/client';

@Injectable()
export class PaystackGatewayProvider implements PaymentGatewayProvider {
  readonly providerName = 'PAYSTACK';
  private readonly logger = new Logger(PaystackGatewayProvider.name);
  private readonly secretKey: string;
  private readonly baseUrl = 'https://api.paystack.co';

  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY || '';
    if (!this.secretKey) {
      this.logger.warn('PAYSTACK_SECRET_KEY is not set');
    }
  }

  async initiateCheckout(params: InitiateCheckoutParams): Promise<CheckoutResult> {
    if (!this.secretKey) {
      throw new BadRequestException('Paystack gateway is not configured');
    }

    const reference = `SUB_${params.planKey}_${params.userId}_${Date.now()}`;
    const payload = {
      email: params.email,
      amount: params.amountKobo,
      reference,
      callback_url: params.callbackUrl,
      metadata: {
        userId: params.userId,
        planKey: params.planKey,
        custom_fields: [
          {
            display_name: 'Plan',
            variable_name: 'plan_key',
            value: params.planKey,
          },
          {
            display_name: 'User ID',
            variable_name: 'user_id',
            value: params.userId,
          },
        ],
        ...(params.metadata || {}),
      },
    };

    try {
      const response = await fetch(`${this.baseUrl}/transaction/initialize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || !data.status) {
        this.logger.error(`Paystack initialize error: ${JSON.stringify(data)}`);
        throw new BadRequestException(
          data.message || 'Failed to initialize Paystack transaction',
        );
      }

      return {
        checkoutUrl: data.data.authorization_url,
        reference: data.data.reference || reference,
        accessCode: data.data.access_code,
      };
    } catch (error) {
      this.logger.error(`Paystack request error: ${error.message}`);
      throw new BadRequestException(
        `Paystack checkout initialization failed: ${error.message}`,
      );
    }
  }

  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
    if (!this.secretKey || !signature) return false;
    const bodyStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const hash = crypto
      .createHmac('sha512', this.secretKey)
      .update(bodyStr)
      .digest('hex');
    return hash === signature;
  }

  async handleWebhookEvent(event: any): Promise<WebhookResult | null> {
    if (event?.event !== 'charge.success') {
      this.logger.log(`Ignoring Paystack event: ${event?.event}`);
      return null;
    }

    const data = event.data;
    const userId = data?.metadata?.userId || data?.metadata?.user_id;
    const planKey = (data?.metadata?.planKey || data?.metadata?.plan_key) as PlanTier;
    const reference = data?.reference;
    const amountKobo = data?.amount;
    const customerCode = data?.customer?.customer_code;

    if (!userId || !planKey || !reference) {
      this.logger.warn(
        `Paystack charge.success missing required metadata: userId=${userId}, planKey=${planKey}, ref=${reference}`,
      );
      return null;
    }

    return {
      success: true,
      userId,
      planKey,
      reference,
      amountKobo,
      gatewayCustomerId: customerCode,
      rawEvent: event,
    };
  }
}
