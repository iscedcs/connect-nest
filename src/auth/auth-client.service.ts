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
  private readonly authUrl = process.env.AUTH_URL;

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
}
