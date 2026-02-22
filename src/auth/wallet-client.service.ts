import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface WalletCardData {
  canReceive: boolean;
  accountNumber?: string;
  bankName?: string;
  accountName?: string | null;
  txLimit?: number | null;
  isceTag?: string | null;
}

export interface CreateArtisanPaymentIntentParams {
  senderUserId: string;
  receiverUserId: string;
  amount: number;
  currency?: string;
  description?: string;
  artisanId: string;
  serviceId?: string;
  serviceName?: string;
  bookingId?: string;
  sourceReference: string;
}

export interface ExecutePaymentIntentParams {
  userId: string;
  intentId: string;
  pin: string;
}

export interface NfcResolveResult {
  userId: string;
  displayName?: string;
  deviceType?: string;
  walletId?: string;
  canPay?: boolean;
}

export interface WalletKycInfo {
  hasWallet: boolean;
  kycLevel: string | null; // 'ZERO' | 'ONE' | 'TWO' | 'THREE'
  canReceive: boolean;
}

@Injectable()
export class WalletClientService {
  private readonly logger = new Logger(WalletClientService.name);
  private readonly walletApiUrl = process.env.WALLET_API_URL;
  private readonly authApiUrl = process.env.AUTH_API_URL;

  /**
   * Fetch the public virtual account details for a user from wallet-nest.
   * Returns canReceive: false if the user has no KYC-verified wallet.
   */
  async getPublicWalletAccount(userId: string): Promise<{
    canReceive: boolean;
    accountNumber?: string;
    bankName?: string;
    accountName?: string | null;
    txLimit?: number | null;
  }> {
    try {
      const res = await axios.get(
        `${this.walletApiUrl}/api/wallets/public-account/${userId}`,
        { timeout: 5000 },
      );
      if (res.data?.success && res.data?.data) {
        return res.data.data;
      }
    } catch (error) {
      this.logger.warn(
        `getPublicWalletAccount failed for userId=${userId}: ${error.message}`,
      );
    }
    return { canReceive: false };
  }

  /**
   * Fetch ISCE Tag info for a user from isce-auth.
   * Returns null if the user has no tag set.
   */
  async getIsceTag(userId: string): Promise<string | null> {
    try {
      const res = await axios.get(`${this.authApiUrl}/user/one/${userId}`, {
        timeout: 5000,
      });
      if (res.data?.success && res.data?.data?.username) {
        return `@${res.data.data.username}`;
      }
    } catch (error) {
      this.logger.warn(
        `getIsceTag failed for userId=${userId}: ${error.message}`,
      );
    }
    return null;
  }

  /**
   * Aggregate wallet account + ISCE Tag for a profile's wallet card.
   * Both calls are made in parallel; individual failures are swallowed.
   */
  async getWalletCardForUser(userId: string): Promise<WalletCardData> {
    const [walletData, isceTag] = await Promise.all([
      this.getPublicWalletAccount(userId),
      this.getIsceTag(userId),
    ]);

    return { ...walletData, isceTag };
  }

  // ─── Artisan Payment Methods ────────────────────────────

  /**
   * Check if a user has a KYC-verified wallet (kycLevel >= ONE).
   * Used during artisan registration to enforce the wallet requirement.
   */
  async getUserWalletKycInfo(userId: string): Promise<WalletKycInfo> {
    try {
      const res = await axios.get(
        `${this.walletApiUrl}/api/wallets/kyc-status`,
        {
          headers: this.buildInternalAuthHeader(userId),
          timeout: 5000,
        },
      );
      if (res.data?.success && res.data?.data) {
        const data = res.data.data;
        const kycLevel = data.kycLevel || 'ZERO';
        return {
          hasWallet: true,
          kycLevel,
          canReceive: kycLevel !== 'ZERO',
        };
      }
    } catch (error) {
      // 404 means no wallet exists
      if (error.response?.status === 404) {
        return { hasWallet: false, kycLevel: null, canReceive: false };
      }
      this.logger.warn(
        `getUserWalletKycInfo failed for userId=${userId}: ${error.message}`,
      );
    }
    return { hasWallet: false, kycLevel: null, canReceive: false };
  }

  /**
   * Create a PaymentIntent for an artisan payment.
   * Sets sourceModule=CONNECT and metadata.isArtisanPayment=true so wallet-nest
   * can detect and apply platform commission on execution.
   */
  async createArtisanPaymentIntent(
    params: CreateArtisanPaymentIntentParams,
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const res = await axios.post(
        `${this.walletApiUrl}/api/payment-intents`,
        {
          type: 'INSTANT',
          amount: params.amount,
          receiverUserId: params.receiverUserId,
          currency: params.currency || 'NGN',
          description:
            params.description ||
            `Payment for artisan service: ${params.serviceName || 'Custom'}`,
          sourceModule: 'CONNECT',
          sourceReference: params.sourceReference,
          metadata: {
            isArtisanPayment: true,
            artisanId: params.artisanId,
            serviceId: params.serviceId || null,
            serviceName: params.serviceName || null,
            bookingId: params.bookingId || null,
          },
        },
        {
          headers: this.buildInternalAuthHeader(params.senderUserId),
          timeout: 10000,
        },
      );
      return res.data;
    } catch (error) {
      this.logger.error(`createArtisanPaymentIntent failed: ${error.message}`);
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to create payment intent',
      };
    }
  }

  /**
   * Execute a PaymentIntent (customer enters PIN to confirm payment).
   */
  async executePaymentIntent(
    params: ExecutePaymentIntentParams,
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const res = await axios.post(
        `${this.walletApiUrl}/api/payment-intents/${params.intentId}/execute`,
        { pin: params.pin },
        {
          headers: this.buildInternalAuthHeader(params.userId),
          timeout: 15000,
        },
      );
      return res.data;
    } catch (error) {
      this.logger.error(
        `executePaymentIntent failed for intentId=${params.intentId}: ${error.message}`,
      );
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to execute payment',
      };
    }
  }

  /**
   * Cancel a PaymentIntent that hasn't been executed yet.
   */
  async cancelPaymentIntent(
    userId: string,
    intentId: string,
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await axios.patch(
        `${this.walletApiUrl}/api/payment-intents/${intentId}/cancel`,
        {},
        {
          headers: this.buildInternalAuthHeader(userId),
          timeout: 5000,
        },
      );
      return res.data;
    } catch (error) {
      this.logger.warn(
        `cancelPaymentIntent failed for intentId=${intentId}: ${error.message}`,
      );
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to cancel payment intent',
      };
    }
  }

  /**
   * Get a specific PaymentIntent by ID.
   */
  async getPaymentIntent(
    userId: string,
    intentId: string,
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const res = await axios.get(
        `${this.walletApiUrl}/api/payment-intents/${intentId}`,
        {
          headers: this.buildInternalAuthHeader(userId),
          timeout: 5000,
        },
      );
      return res.data;
    } catch (error) {
      this.logger.warn(
        `getPaymentIntent failed for intentId=${intentId}: ${error.message}`,
      );
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to get payment intent',
      };
    }
  }

  /**
   * Resolve an NFC productId to user + wallet info.
   * Used for tap-to-pay flow where customer taps their card on artisan's phone.
   */
  async resolveNfc(
    productId: string,
  ): Promise<{ success: boolean; data?: NfcResolveResult; message?: string }> {
    try {
      const res = await axios.get(`${this.walletApiUrl}/api/nfc/resolve`, {
        params: { productId },
        timeout: 5000,
      });
      return res.data;
    } catch (error) {
      this.logger.warn(
        `resolveNfc failed for productId=${productId}: ${error.message}`,
      );
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to resolve NFC device',
      };
    }
  }

  /**
   * Check if a user has a completed payment to a specific artisan.
   * Used for review eligibility — users can review artisans they've paid.
   * Queries wallet-nest PaymentIntents matching sourceModule=CONNECT, status=EXECUTED,
   * and metadata.isArtisanPayment=true for the given sender→receiver pair.
   */
  async hasCompletedArtisanPayment(
    customerUserId: string,
    artisanUserId: string,
  ): Promise<boolean> {
    try {
      const res = await axios.get(
        `${this.walletApiUrl}/api/payment-intents/match`,
        {
          params: {
            profileUserId: artisanUserId,
            sourceModule: 'CONNECT',
          },
          headers: this.buildInternalAuthHeader(customerUserId),
          timeout: 5000,
        },
      );
      if (res.data?.success && Array.isArray(res.data?.data)) {
        return res.data.data.some(
          (intent: any) =>
            intent.status === 'EXECUTED' &&
            intent.metadata?.isArtisanPayment === true,
        );
      }
    } catch (error) {
      this.logger.warn(
        `hasCompletedArtisanPayment check failed for customer=${customerUserId}, artisan=${artisanUserId}: ${error.message}`,
      );
    }
    return false;
  }

  // ─── Internal Helpers ───────────────────────────────────

  /**
   * Build an authorization header for internal service-to-service calls.
   * In production this should use a service token or shared secret;
   * for now we forward the user context via a lightweight internal JWT.
   */
  private buildInternalAuthHeader(userId: string): Record<string, string> {
    // TODO: Replace with proper service-to-service auth (e.g. internal API key)
    // For now, wallet-nest public endpoints don't need auth,
    // and authenticated endpoints will need the user's actual JWT forwarded from the controller.
    return {
      'Content-Type': 'application/json',
      'X-Internal-User-Id': userId,
    };
  }
}
