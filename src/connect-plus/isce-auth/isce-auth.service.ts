import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface StaffInvitePayload {
  email: string;
  token: string;
  role: string;
  workspaceName: string;
  inviterName: string;
  name?: string;
  jobTitle?: string;
  department?: string;
}

export interface ClientInvitePayload {
  email: string;
  token: string;
  clientId: string;
}

export interface AdminInvitePayload {
  email: string;
  token: string;
  role: string;
  workspaceName: string;
  inviterName: string;
}

@Injectable()
export class IsceAuthService {
  private readonly logger = new Logger(IsceAuthService.name);
  private readonly apiUrl = process.env.AUTH_API_URL;
  private readonly apiKey = process.env.AUTH_API_KEY;

  constructor(private readonly http: HttpService) {}

  async sendStaffInvite(payload: StaffInvitePayload): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/internal/cp/invite-staff`, payload, {
          headers: { 'x-api-key': this.apiKey },
        }),
      );
    } catch (err) {
      // Non-blocking: log error but do not throw
      this.logger.error(
        `Failed to dispatch staff invite to ${payload.email}: ${(err as Error).message}`,
      );
    }
  }

  async sendAdminInvite(payload: AdminInvitePayload): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/internal/cp/invite-admin`, payload, {
          headers: { 'x-api-key': this.apiKey },
        }),
      );
    } catch (err) {
      this.logger.error(
        `Failed to dispatch admin invite to ${payload.email}: ${(err as Error).message}`,
      );
    }
  }

  async sendClientInvite(payload: ClientInvitePayload): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/internal/cp/invite-client`, payload, {
          headers: { 'x-api-key': this.apiKey },
        }),
      );
    } catch (err) {
      this.logger.error(
        `Failed to dispatch client invite to ${payload.email}: ${(err as Error).message}`,
      );
    }
  }
}
