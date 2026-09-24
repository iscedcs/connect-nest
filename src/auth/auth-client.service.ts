import {
  Injectable,
  NotFoundException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import axios from 'axios';

export interface DeviceResponse {
  userId: string | null;
  productId: string;
  id: string;
  label: string | null;
  isActive: boolean | null;
  isPrimary: boolean | null;
  assignedAt: Date;
  lastUsedAt: Date | null;
  type: string;
}

@Injectable()
export class AuthClientService {
  private readonly authUrl = process.env.AUTH_API_URL;
  private readonly internalKey = process.env.INTERNAL_API_KEY;

  async getDeviceByDeviceId(deviceId: string): Promise<DeviceResponse> {
    try {
      console.log('DEVICE ID', deviceId);
      // isce-auth's /device/product/:productId is JWT+ADMIN-only (II-72) —
      // this internal-key-gated twin is what the public NFC tap flow uses.
      const response = await axios.get(
        `${this.authUrl}/internal/device/product/${deviceId}`,
        { headers: { 'x-internal-key': this.internalKey ?? '' } },
      );

      console.log('DEVICE RESPONSE', response.data);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }

      throw new NotFoundException('Device not found');
    } catch (error) {
      if (
        error.response?.status === 404 ||
        error instanceof NotFoundException
      ) {
        throw new NotFoundException('Device not found');
      }
      throw new Error(`Failed to fetch device: ${error.message}`);
    }
  }

  /** Fetch user email from isce-auth by userId (internal endpoint). */
  async getUserEmail(userId: string): Promise<string | null> {
    try {
      const response = await axios.get(`${this.authUrl}/user/${userId}`, {
        headers: { 'x-internal-key': this.internalKey ?? '' },
      });
      return response.data?.data?.email || response.data?.email || null;
    } catch {
      return null;
    }
  }

  /** Fetch FCM tokens for a user from isce-auth (internal endpoint). */
  async getFcmTokens(userId: string): Promise<string[]> {
    try {
      const response = await axios.get(
        `${this.authUrl}/device/session/tokens/${userId}`,
        { headers: { 'x-internal-key': this.internalKey ?? '' } },
      );
      if (response.data?.success && Array.isArray(response.data.data)) {
        return response.data.data as string[];
      }
      return [];
    } catch {
      return [];
    }
  }

  /** Proxy for ISCE Auth GET /referral/referred */
  async listReferredUsers(
    authHeader: string,
    page = 1,
    limit = 20,
  ): Promise<any> {
    try {
      const response = await axios.get(`${this.authUrl}/referral/referred`, {
        headers: {
          Authorization: authHeader,
        },
        params: { page, limit },
      });
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new HttpException(error.response.data, error.response.status);
      }
      throw new InternalServerErrorException(
        'Failed to fetch referred users',
      );
    }
  }

  /** Proxy for ISCE Auth GET /referral/me */
  async getReferralSummary(authHeader: string): Promise<any> {
    try {
      const response = await axios.get(`${this.authUrl}/referral/me`, {
        headers: {
          Authorization: authHeader,
        },
      });
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new HttpException(
          error.response.data,
          error.response.status,
        );
      }
      throw new InternalServerErrorException(
        'Failed to fetch referral summary',
      );
    }
  }

  /** Proxy for ISCE Auth POST /referral/business/apply */
  async applyForBusinessReferrer(authHeader: string): Promise<any> {
    try {
      const response = await axios.post(
        `${this.authUrl}/referral/business/apply`,
        {},
        {
          headers: {
            Authorization: authHeader,
          },
        },
      );
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new HttpException(
          error.response.data,
          error.response.status,
        );
      }
      throw new InternalServerErrorException(
        'Failed to apply for business referrer',
      );
    }
  }

  /** Proxy for ISCE Auth POST /referral/cash-out */
  async requestCashOut(authHeader: string): Promise<any> {
    try {
      const response = await axios.post(
        `${this.authUrl}/referral/cash-out`,
        {},
        {
          headers: {
            Authorization: authHeader,
          },
        },
      );
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new HttpException(
          error.response.data,
          error.response.status,
        );
      }
      throw new InternalServerErrorException(
        'Failed to request cash out',
      );
    }
  }

  /**
   * Bind a new user to a referrer.
   * Uses the internal key — never called from the browser.
   * Safe to call on every signup; isce-auth silently no-ops if
   * referredById is already set, the code is unknown, or it's a self-referral.
   */
  async attachReferral(
    newUserId: string,
    referralUsername: string,
  ): Promise<any> {
    try {
      const response = await axios.post(
        `${this.authUrl}/internal/referral/attach`,
        { newUserId, referralUsername },
        { headers: { 'x-internal-key': this.internalKey ?? '' } },
      );
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new HttpException(
          error.response.data,
          error.response.status,
        );
      }
      throw new InternalServerErrorException('Failed to attach referral');
    }
  }

  /** Proxy for ISCE Auth PATCH /admin/referral/business/:userId */
  async adminPatchBusinessReferrer(
    userId: string,
    body: { status: string; businessReferrerReward?: number },
    authHeader: string,
  ): Promise<any> {
    try {
      const response = await axios.patch(
        `${this.authUrl}/admin/referral/business/${userId}`,
        body,
        { headers: { Authorization: authHeader } },
      );
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new HttpException(
          error.response.data,
          error.response.status,
        );
      }
      throw new InternalServerErrorException(
        'Failed to update business referrer status',
      );
    }
  }

  /** Proxy for ISCE Auth GET /admin/referral/stats */
  async adminGetReferralStats(authHeader: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.authUrl}/admin/referral/stats`,
        { headers: { Authorization: authHeader } },
      );
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new HttpException(
          error.response.data,
          error.response.status,
        );
      }
      throw new InternalServerErrorException(
        'Failed to fetch referral stats',
      );
    }
  }

  /** Proxy for ISCE Auth GET /admin/referral/default-account */
  async adminGetDefaultAccount(authHeader: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.authUrl}/admin/referral/default-account`,
        { headers: { Authorization: authHeader } },
      );
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new HttpException(
          error.response.data,
          error.response.status,
        );
      }
      throw new InternalServerErrorException(
        'Failed to fetch default referral account',
      );
    }
  }
}

