import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailClientService {
  private readonly logger = new Logger(MailClientService.name);
  private readonly authApiUrl = process.env.AUTH_API_URL;
  private readonly internalKey = process.env.INTERNAL_API_KEY;

  async sendEmail(params: {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
  }): Promise<boolean> {
    if (!this.authApiUrl || !this.internalKey) {
      this.logger.error(
        '[MailClient] AUTH_API_URL or INTERNAL_API_KEY not configured',
      );
      return false;
    }

    try {
      const res = await fetch(`${this.authApiUrl}/internal/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-key': this.internalKey,
        },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        this.logger.error(
          `[MailClient] HTTP ${res.status} for "${params.subject}"`,
        );
        return false;
      }

      const data = await res.json();
      this.logger.log(
        `[MailClient] ${data.sent}/${data.sent + data.failed} email(s) sent: "${params.subject}"`,
      );
      return data.success;
    } catch (error) {
      this.logger.error(
        `[MailClient] Failed to send "${params.subject}": ${error.message}`,
      );
      return false;
    }
  }
}
