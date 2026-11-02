import { Injectable, Logger } from '@nestjs/common';
import { MailClientService } from '../../mail/mail-client.service';

export interface StaffInvitePayload {
  email: string;
  token: string;
  role: string;
  workspaceId: string;
  workspaceName: string;
  inviterName: string;
  name?: string;
  jobTitle?: string;
  department?: string;
}

export interface ClientInvitePayload {
  email: string;
  token: string;
  workspaceId: string;
  clientId: string;
}

export interface AdminInvitePayload {
  email: string;
  token: string;
  role: string;
  workspaceId: string;
  workspaceName: string;
  inviterName: string;
}

@Injectable()
export class IsceAuthService {
  private readonly logger = new Logger(IsceAuthService.name);
  // Absolute base of connect-web (e.g. https://connect.isce.app), no trailing slash.
  private readonly webUrl = (process.env.CONNECT_WEB_URL ?? '').replace(
    /\/+$/,
    '',
  );

  constructor(private readonly mail: MailClientService) {
    if (!this.webUrl) {
      this.logger.warn(
        'CONNECT_WEB_URL is not set: invite emails will contain a link without a host',
      );
    }
  }

  /**
   * Points at connect-web's `/cp/invites/accept` page. The token can also be
   * redeemed directly via isce-auth's /auth/signup or /auth/signin, which
   * accept inviteToken/inviteWorkspaceId/inviteRole and notify connect-nest
   * on success (see CpWebhooksService.handleInviteAccepted).
   */
  private inviteLink(token: string, workspaceId: string, role: string): string {
    return `${this.webUrl}/cp/invites/accept?token=${encodeURIComponent(token)}&workspaceId=${encodeURIComponent(workspaceId)}&role=${encodeURIComponent(role)}`;
  }

  async sendStaffInvite(payload: StaffInvitePayload): Promise<void> {
    const link = this.inviteLink(
      payload.token,
      payload.workspaceId,
      payload.role,
    );
    const sent = await this.mail.sendEmail({
      to: payload.email,
      subject: `You've been invited to join ${payload.workspaceName} on Lyncon Plus`,
      html: `<p>Hi${payload.name ? ` ${payload.name}` : ''},</p>
<p>${payload.inviterName} invited you to join <strong>${payload.workspaceName}</strong> as ${payload.role} on Lyncon Plus.</p>
<p><a href="${link}">Accept invite</a></p>
<p>This link expires in 7 days.</p>`,
    });
    if (!sent) {
      this.logger.error(`Failed to dispatch staff invite to ${payload.email}`);
    }
  }

  async sendAdminInvite(payload: AdminInvitePayload): Promise<void> {
    const link = this.inviteLink(
      payload.token,
      payload.workspaceId,
      payload.role,
    );
    const sent = await this.mail.sendEmail({
      to: payload.email,
      subject: `You've been invited to administer ${payload.workspaceName} on Lyncon Plus`,
      html: `<p>Hi,</p>
<p>${payload.inviterName} invited you to become a workspace admin for <strong>${payload.workspaceName}</strong> on Lyncon Plus.</p>
<p><a href="${link}">Accept invite</a></p>
<p>This link expires in 7 days.</p>`,
    });
    if (!sent) {
      this.logger.error(`Failed to dispatch admin invite to ${payload.email}`);
    }
  }

  async sendClientInvite(payload: ClientInvitePayload): Promise<void> {
    const link = this.inviteLink(payload.token, payload.workspaceId, 'CLIENT');
    const sent = await this.mail.sendEmail({
      to: payload.email,
      subject: `You've been invited to Lyncon Plus`,
      html: `<p>Hi,</p>
<p>You've been invited to join Lyncon Plus as a client.</p>
<p><a href="${link}">Accept invite</a></p>
<p>This link expires in 7 days.</p>`,
    });
    if (!sent) {
      this.logger.error(`Failed to dispatch client invite to ${payload.email}`);
    }
  }
}
