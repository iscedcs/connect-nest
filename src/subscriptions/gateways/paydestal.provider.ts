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
export class PaydestalGatewayProvider implements PaymentGatewayProvider {
  readonly providerName = 'PAYDESTAL';
  private readonly logger = new Logger(PaydestalGatewayProvider.name);
  private readonly baseUrl: string;
  private readonly secretKey: string;

  constructor() {
    this.baseUrl = process.env.PAYDESTAL_BASE_URL || 'https://api.paydestal.com/v1';
    this.secretKey = process.env.PAYDESTAL_SECRET_KEY || '';
  }

  async initiateCheckout(params: InitiateCheckoutParams): Promise<CheckoutResult> {
    if (!this.secretKey) {
      this.logger.warn('Paydestal credentials not configured; returning mock session');
      const reference = `MOCK_PD_${params.planKey}_${params.userId}_${Date.now()}`;
      return {
        checkoutUrl: `https://checkout.paydestal.com/pay/${reference}`,
        reference,
        gatewaySessionId: `sess_${reference}`,
      };
    }

    const reference = `SUB_PD_${params.planKey}_${params.userId}_${Date.now()}`;
    try {
      const response = await fetch(`${this.baseUrl}/checkout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: params.amountKobo / 100, // Paydestal amounts in main currency unit (Naira)
          email: params.email,
          reference,
          callbackUrl: params.callbackUrl,
          metadata: {
            userId: params.userId,
            planKey: params.planKey,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new BadRequestException(data.message || 'Paydestal checkout error');
      }

      return {
        checkoutUrl: data.checkoutUrl || data.paymentUrl,
        reference: data.reference || reference,
        gatewaySessionId: data.sessionId,
      };
    } catch (err) {
      this.logger.error(`Paydestal request error: ${err.message}`);
      throw new BadRequestException(`Paydestal checkout error: ${err.message}`);
    }
  }

  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
    if (!this.secretKey || !signature) return false;
    const bodyStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const hash = crypto
      .createHmac('sha256', this.secretKey)
      .update(bodyStr)
      .digest('hex');
    return hash === signature;
  }

  async handleWebhookEvent(event: any): Promise<WebhookResult | null> {
    if (event?.event !== 'payment.success' && event?.status !== 'success') {
      return null;
    }

    const data = event.data || event;
    const userId = data?.metadata?.userId;
    const planKey = data?.metadata?.planKey as PlanTier;
    const reference = data?.reference;
    const amountKobo = data?.amount ? data.amount * 100 : 0;

    if (!userId || !planKey || !reference) return null;

    return {
      success: true,
      userId,
      planKey,
      reference,
      amountKobo,
      gatewayCustomerId: data?.customerId,
      rawEvent: event,
    };
  }
}
