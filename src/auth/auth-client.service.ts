import { Injectable, NotFoundException } from '@nestjs/common';
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
      const response = await axios.get(
        `${this.authUrl}/device/product/${deviceId}`,
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
}
