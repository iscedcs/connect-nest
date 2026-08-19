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

export interface PaymentGatewayProvider {
  readonly providerName: string;

  initiateCheckout(params: InitiateCheckoutParams): Promise<CheckoutResult>;

  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean;

  handleWebhookEvent(event: any): Promise<WebhookResult | null>;
}
