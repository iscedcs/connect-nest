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
}
