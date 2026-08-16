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
  private readonly webUrl = process.env.CONNECT_WEB_URL ?? '';

  constructor(private readonly mail: MailClientService) {}

  /**
   * connect-web has no /cp/invite/accept page yet, so this link is a stub
   * for when Connect Plus gets a frontend. Until then the token can be
   * redeemed directly via isce-auth's /auth/signup or /auth/signin, which
   * accept inviteToken/inviteWorkspaceId/inviteRole and notify connect-nest
   * on success (see CpWebhooksService.handleInviteAccepted).
   */
  private inviteLink(token: string, workspaceId: string, role: string): string {
    return `${this.webUrl}/cp/invite/accept?token=${encodeURIComponent(token)}&workspaceId=${encodeURIComponent(workspaceId)}&role=${encodeURIComponent(role)}`;
  }

  async sendStaffInvite(payload: StaffInvitePayload): Promise<void> {
    const link = this.inviteLink(payload.token, payload.workspaceId, payload.role);
    const sent = await this.mail.sendEmail({
      to: payload.email,
      subject: `You've been invited to join ${payload.workspaceName} on Connect Plus`,
      html: `<p>Hi${payload.name ? ` ${payload.name}` : ''},</p>
<p>${payload.inviterName} invited you to join <strong>${payload.workspaceName}</strong> as ${payload.role} on Connect Plus.</p>
<p><a href="${link}">Accept invite</a></p>
<p>This link expires in 7 days.</p>`,
    });
    if (!sent) {
      this.logger.error(`Failed to dispatch staff invite to ${payload.email}`);
    }
  }

  async sendAdminInvite(payload: AdminInvitePayload): Promise<void> {
    const link = this.inviteLink(payload.token, payload.workspaceId, payload.role);
    const sent = await this.mail.sendEmail({
      to: payload.email,
      subject: `You've been invited to administer ${payload.workspaceName} on Connect Plus`,
      html: `<p>Hi,</p>
<p>${payload.inviterName} invited you to become a workspace admin for <strong>${payload.workspaceName}</strong> on Connect Plus.</p>
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
      subject: `You've been invited to Connect Plus`,
      html: `<p>Hi,</p>
<p>You've been invited to join Connect Plus as a client.</p>
<p><a href="${link}">Accept invite</a></p>
<p>This link expires in 7 days.</p>`,
    });
    if (!sent) {
      this.logger.error(`Failed to dispatch client invite to ${payload.email}`);
    }
  }
}
