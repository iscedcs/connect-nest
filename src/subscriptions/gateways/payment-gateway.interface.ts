import { PlanTier } from '../../generated/prisma/client';
import type { CheckoutKind, PaymentMethod } from '../subscriptions.service';
import type { SavedCardSummary } from './wallet-nest.client';

export interface InitiateCheckoutParams {
  userId: string;
  email: string;
  planKey: PlanTier;
  amountKobo: number;
  callbackUrl?: string;
  metadata?: Record<string, any>;
  /** Keep the card for automatic renewals (wallet-nest vaults it). */
  saveCard?: boolean;
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
   * covered the difference for the rest of the current period, `trial` for
   * the card check that starts a trial, `renewal` for an automatic charge.
   */
  checkoutKind?: CheckoutKind;
  /** The plan a prorated upgrade was priced from. */
  fromPlanKey?: PlanTier;
  /**
   * The period end the payment was priced against (ISO): the unchanged
   * renewal date of a prorated upgrade, or the date an automatic renewal
   * renews from. The payment only fits the period running when it was priced.
   */
  pricedPeriodEnd?: string;
  /** Whether the user asked for the plan to renew itself from this payment's card or wallet. */
  autoRenew?: boolean;
  /** How it was paid; CARD unless it came from the wallet. */
  paymentMethod?: PaymentMethod;
  /** The card wallet-nest saved from this payment, for card renewals. */
  savedCard?: SavedCardSummary;
  /** The wallet mandate granted with this payment, for wallet renewals. */
  walletMandateId?: string | null;
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
