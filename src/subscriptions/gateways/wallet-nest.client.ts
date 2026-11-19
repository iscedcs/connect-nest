import {
  BadGatewayException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

/** A card saved at wallet-nest for Connect, as its forwarded webhook describes it. */
export interface SavedCardSummary {
  id: string;
  last4: string;
  brand: string | null;
  bank: string | null;
  expMonth: string | null;
  expYear: string | null;
}

/** The result of an automatic charge: a decline is a result, not an error. */
export interface AutoChargeResult {
  /** `success` only if the money was taken. */
  status: string;
  reference: string;
  reason: string | null;
}

/**
 * wallet-nest's internal API, for what connect-nest can't do itself: it holds
 * no Paystack key and no wallet. Charging a saved card, taking a wallet
 * payment, and charging under a wallet mandate all happen there.
 *
 * A saved card or mandate that no longer exists is a NotFoundException, so
 * the caller can stop renewing automatically; every other failure to reach
 * wallet-nest is a 502.
 */
@Injectable()
export class WalletNestClient {
  private readonly logger = new Logger(WalletNestClient.name);
  static readonly SERVICE = 'connect';

  private get baseUrl(): string {
    return (process.env.WALLET_API_URL ?? '').replace(/\/+$/, '');
  }

  /** "visa •••• 4081": what the plan page shows for the saved card. */
  static cardLabel(card: Pick<SavedCardSummary, 'brand' | 'last4'>): string {
    return `${card.brand ?? 'card'} •••• ${card.last4}`;
  }

  /** Start a wallet payment the user then approves with their PIN. */
  createWalletPayment(params: {
    userId: string;
    amountKobo: number;
    reference: string;
    description: string;
    metadata: Record<string, unknown>;
    mandateMaxAmountKobo?: number;
  }): Promise<{
    id: string;
    amountKobo: number;
    balanceSufficient: boolean;
  }> {
    return this.post('/api/internal/service-payments', {
      service: WalletNestClient.SERVICE,
      ...params,
    });
  }

  /** Take a renewal from the wallet under the user's mandate (no PIN). */
  async chargeMandate(params: {
    mandateId: string;
    userId: string;
    amountKobo: number;
    reference: string;
    description: string;
    metadata: Record<string, unknown>;
  }): Promise<AutoChargeResult> {
    const data = await this.post<{
      status: string;
      reference: string;
      reason: string | null;
    }>('/api/internal/service-payments/mandate-charge', {
      service: WalletNestClient.SERVICE,
      ...params,
    });
    return {
      status: data.status,
      reference: data.reference,
      reason: data.reason,
    };
  }

  /** Charge the card saved for this user. */
  async chargeSavedCard(
    cardId: string,
    params: {
      userId: string;
      amountKobo: number;
      reference: string;
      metadata: Record<string, unknown>;
    },
  ): Promise<AutoChargeResult> {
    const data = await this.post<{
      status: string;
      reference: string;
      gatewayResponse: string | null;
    }>(
      `/api/internal/paystack/saved-cards/${encodeURIComponent(cardId)}/charge`,
      {
        service: WalletNestClient.SERVICE,
        ownerRef: params.userId,
        amountKobo: params.amountKobo,
        reference: params.reference,
        metadata: params.metadata,
      },
    );
    return {
      status: data.status,
      reference: data.reference,
      reason: data.gatewayResponse,
    };
  }

  /** Forget the saved card (revoked at Paystack too). */
  async removeSavedCard(cardId: string, userId: string): Promise<void> {
    await this.post(
      `/api/internal/paystack/saved-cards/${encodeURIComponent(cardId)}/remove`,
      { service: WalletNestClient.SERVICE, ownerRef: userId },
    );
  }

  /** Stop automatic wallet payments to Connect. */
  async revokeMandate(mandateId: string, userId: string): Promise<void> {
    await this.post(
      `/api/internal/service-mandates/${encodeURIComponent(mandateId)}/revoke`,
      { service: WalletNestClient.SERVICE, userId },
    );
  }

  private async post<T = any>(path: string, body: unknown): Promise<T> {
    const internalKey = process.env.INTERNAL_API_KEY;
    if (!this.baseUrl || !internalKey) {
      throw new BadGatewayException(
        'Payments are not configured (WALLET_API_URL / INTERNAL_API_KEY)',
      );
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': internalKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
    } catch (error) {
      this.logger.error(`wallet-nest unreachable (${path}): ${error.message}`);
      throw new BadGatewayException('Could not reach the payment service');
    }

    const json = await response.json().catch(() => ({}));
    if (response.ok) return (json?.data ?? json) as T;

    const raw = json?.message;
    const message = Array.isArray(raw) ? raw.join('. ') : String(raw ?? '');
    if (response.status === 404) {
      throw new NotFoundException(message || 'Not found at wallet-nest');
    }
    // A refusal the user can act on (no wallet PIN, wallet not active,
    // amount over the mandate) passes through; anything else is ours.
    if (response.status === 400 || response.status === 409) {
      throw new HttpException(message, response.status);
    }
    this.logger.error(
      `wallet-nest ${path} failed | status=${response.status} | ${message}`,
    );
    throw new BadGatewayException(
      'The payment service could not complete this',
    );
  }
}
