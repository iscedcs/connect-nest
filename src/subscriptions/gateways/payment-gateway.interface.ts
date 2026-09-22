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
  /**
   * From the checkout's metadata: `prorated_upgrade` when the payment only
   * covered the difference for the rest of the current period.
   */
  checkoutKind?: 'full' | 'prorated_upgrade';
  /** The plan a prorated upgrade was priced from. */
  fromPlanKey?: PlanTier;
  /**
   * The renewal date a prorated upgrade was priced against (ISO). The
   * payment only fits the period that was running when it was priced.
   */
  pricedPeriodEnd?: string;
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

  chargeRecurring?(
    params: ChargeRecurringParams,
  ): Promise<ChargeRecurringResult>;

  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean;

  handleWebhookEvent(event: any): Promise<WebhookResult | null>;
}
