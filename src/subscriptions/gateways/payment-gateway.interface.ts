import { PlanTier } from '../../generated/prisma/client';

export interface InitiateCheckoutParams {
  userId: string;
  email: string;
  planKey: PlanTier;
  amountKobo: number;
  callbackUrl?: string;
  metadata?: Record<string, any>;
}

export interface CheckoutResult {
  checkoutUrl: string;
  reference: string;
  gatewaySessionId?: string;
  accessCode?: string;
}

export interface WebhookResult {
  success: boolean;
  userId: string;
  planKey: PlanTier;
  reference: string;
  amountKobo: number;
  gatewayCustomerId?: string;
  rawEvent?: any;
}

export interface ChargeRecurringParams {
  email: string;
  amountKobo: number;
  authorizationCode: string;
  reference?: string;
  metadata?: Record<string, any>;
}

export interface ChargeRecurringResult {
  success: boolean;
  reference: string;
  amountKobo: number;
  status: string;
  rawResponse?: any;
}

export interface PaymentGatewayProvider {
  readonly providerName: string;

  initiateCheckout(params: InitiateCheckoutParams): Promise<CheckoutResult>;

  chargeRecurring?(params: ChargeRecurringParams): Promise<ChargeRecurringResult>;

  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean;

  handleWebhookEvent(event: any): Promise<WebhookResult | null>;
}

