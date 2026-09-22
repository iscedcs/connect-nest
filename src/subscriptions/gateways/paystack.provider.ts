import {
  Injectable,
  Logger,
  BadRequestException,
  BadGatewayException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  PaymentGatewayProvider,
  InitiateCheckoutParams,
  CheckoutResult,
  WebhookResult,
} from './payment-gateway.interface';
import { PlanTier } from '../../generated/prisma/client';
import { CHECKOUT_KINDS, CheckoutKind } from '../subscriptions.service';

@Injectable()
export class PaystackGatewayProvider implements PaymentGatewayProvider {
  readonly providerName = 'PAYSTACK';
  private readonly logger = new Logger(PaystackGatewayProvider.name);
  private readonly secretKey: string;
  private readonly baseUrl = 'https://api.paystack.co';
  private readonly walletApiUrl: string;
  private readonly internalKey: string;

  constructor() {
    // Only chargeRecurring and the direct webhook route still use the key;
    // checkout goes through wallet-nest, which holds it.
    this.secretKey = process.env.PAYSTACK_SECRET_KEY || '';
    this.walletApiUrl = (process.env.WALLET_API_URL || '').replace(/\/+$/, '');
    this.internalKey = process.env.INTERNAL_API_KEY || '';
  }

  /**
   * wallet-nest creates the charge: it holds the Paystack key and owns the only
   * webhook Paystack can deliver to. The charge is tagged service=connect, so
   * wallet-nest forwards its charge.success to
   * POST /api/subscriptions/webhooks/internal/paystack-event. The payer needs no wallet.
   */
  async initiateCheckout(
    params: InitiateCheckoutParams,
  ): Promise<CheckoutResult> {
    if (!this.walletApiUrl || !this.internalKey) {
      throw new BadRequestException(
        'Card payments are not configured (WALLET_API_URL / INTERNAL_API_KEY)',
      );
    }

    const reference = `SUB_${params.planKey}_${params.userId}_${Date.now()}`;
    const payload = {
      service: 'connect',
      email: params.email,
      amountKobo: params.amountKobo,
      reference,
      callbackUrl: params.callbackUrl,
      // wallet-nest keeps the card and forwards only its id and label.
      ...(params.saveCard && { saveCardFor: params.userId }),
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

    let response: Response;
    try {
      response = await fetch(
        `${this.walletApiUrl}/api/internal/paystack/initialize`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Secret': this.internalKey,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000),
        },
      );
    } catch (error) {
      this.logger.error(`wallet-nest checkout unreachable: ${error.message}`);
      throw new BadGatewayException('Could not start the card payment');
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.status || !data?.data?.authorization_url) {
      this.logger.error(
        `wallet-nest checkout failed | status=${response.status} | ref=${reference} | ${JSON.stringify(data)}`,
      );
      throw new BadGatewayException('Could not start the card payment');
    }

    return {
      checkoutUrl: data.data.authorization_url,
      reference: data.data.reference || reference,
      accessCode: data.data.access_code,
    };
  }

  async chargeRecurring(params: {
    email: string;
    amountKobo: number;
    authorizationCode: string;
    reference?: string;
    metadata?: Record<string, any>;
  }) {
    if (!this.secretKey) {
      throw new BadRequestException('Paystack gateway is not configured');
    }

    const reference =
      params.reference ||
      `REC_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const payload = {
      email: params.email,
      amount: params.amountKobo,
      authorization_code: params.authorizationCode,
      reference,
      metadata: params.metadata,
    };

    try {
      const response = await fetch(
        `${this.baseUrl}/transaction/charge_authorization`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json();
      if (!response.ok || !data.status) {
        this.logger.error(
          `Paystack charge_authorization error: ${JSON.stringify(data)}`,
        );
        return {
          success: false,
          reference,
          amountKobo: params.amountKobo,
          status: data.data?.status || 'failed',
          rawResponse: data,
        };
      }

      return {
        success: data.data?.status === 'success',
        reference: data.data?.reference || reference,
        amountKobo: data.data?.amount || params.amountKobo,
        status: data.data?.status || 'success',
        rawResponse: data,
      };
    } catch (error) {
      this.logger.error(`Paystack recurring charge error: ${error.message}`);
      throw new BadRequestException(
        `Paystack recurring charge failed: ${error.message}`,
      );
    }
  }

  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
    if (!this.secretKey || !signature) return false;
    const bodyStr =
      typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const hash = crypto
      .createHmac('sha512', this.secretKey)
      .update(bodyStr)
      .digest('hex');
    const hashBuf = Buffer.from(hash);
    const sigBuf = Buffer.from(signature);
    if (hashBuf.length !== sigBuf.length) return false;
    return crypto.timingSafeEqual(hashBuf, sigBuf);
  }

  async handleWebhookEvent(event: any): Promise<WebhookResult | null> {
    if (event?.event !== 'charge.success') {
      this.logger.log(`Ignoring Paystack event: ${event?.event}`);
      return null;
    }

    const data = event.data;
    const userId = data?.metadata?.userId || data?.metadata?.user_id;
    const planKey = (data?.metadata?.planKey ||
      data?.metadata?.plan_key) as PlanTier;
    const reference = data?.reference;
    const amountKobo = data?.amount;
    const customerCode = data?.customer?.customer_code;

    if (!userId || !planKey || !reference) {
      this.logger.warn(
        `Paystack charge.success missing required metadata: userId=${userId}, planKey=${planKey}, ref=${reference}`,
      );
      return null;
    }

    // Set by initiate-payment and the renewal job; absent on older checkouts,
    // which were always full-price.
    const kind = data?.metadata?.checkoutKind;
    const checkoutKind: CheckoutKind = CHECKOUT_KINDS.includes(kind)
      ? kind
      : 'full';

    return {
      success: true,
      userId,
      planKey,
      reference,
      amountKobo,
      gatewayCustomerId: customerCode,
      checkoutKind,
      fromPlanKey: data?.metadata?.fromPlanKey as PlanTier | undefined,
      pricedPeriodEnd: (data?.metadata?.anchor ?? data?.metadata?.renewsAt) as
        string | undefined,
      autoRenew: data?.metadata?.autoRenew === true,
      paymentMethod: 'CARD',
      rawEvent: event,
    };
  }
}
