import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { NotificationType } from '../generated/prisma/client';

export interface SendEmailOptions {
  to: string;
  recipientName?: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly fromAddress: string;
  private readonly appUrl: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.fromAddress =
      process.env.RESEND_FROM_EMAIL || 'ISCE Connect <notifications@isce.app>';
    this.appUrl = process.env.APP_URL || 'https://connect.isce.app';

    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.resend = null;
      this.logger.warn('RESEND_API_KEY not set — email notifications disabled');
    }
  }

  async sendNotificationEmail(options: SendEmailOptions): Promise<void> {
    if (!this.resend) return;

    try {
      const html = this.buildEmailHtml(options);

      await this.resend.emails.send({
        from: this.fromAddress,
        to: options.to,
        subject: options.title,
        html,
      });

      this.logger.debug(`Email sent to ${options.to}: ${options.title}`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${options.to}`, err);
    }
  }

  private buildEmailHtml(options: SendEmailOptions): string {
    const { recipientName, title, message, type, actionUrl, actionLabel } =
      options;
    const greeting = recipientName ? `Hi ${recipientName},` : 'Hi there,';
    const icon = this.getEmojiForType(type);
    const category = this.getCategoryLabel(type);
    const btnUrl = actionUrl || this.appUrl;
    const btnLabel = actionLabel || 'Open ISCE Connect';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#111;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#1a1a1a;border-radius:12px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:24px 24px 16px;background:linear-gradient(135deg,#6366f1,#8b5cf6);text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">ISCE Connect</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:12px;text-transform:uppercase;letter-spacing:1px;">${category}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:24px;">
              <p style="margin:0 0 16px;color:#e5e5e5;font-size:14px;">${greeting}</p>
              <div style="background:#222;border-radius:8px;padding:16px;border-left:4px solid #6366f1;">
                <p style="margin:0 0 4px;color:#fff;font-size:15px;font-weight:600;">${icon} ${title}</p>
                <p style="margin:0;color:#a3a3a3;font-size:14px;line-height:1.5;">${message}</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
                <tr>
                  <td align="center">
                    <a href="${btnUrl}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">${btnLabel}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 24px;border-top:1px solid #333;text-align:center;">
              <p style="margin:0;color:#666;font-size:12px;">You received this because you have an ISCE Connect account.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
  }

  private getEmojiForType(type: NotificationType): string {
    const map: Record<NotificationType, string> = {
      CARD_INTERACTION: '👆',
      CONTACT_SHARED: '📇',
      WALLET_UPDATE: '💰',
      WALLET_FUNDED: '💵',
      WALLET_TRANSFER: '🔄',
      CONTACT_SAVED: '📱',
      MEETING_REQUEST: '📅',
      APPOINTMENT_BOOKED: '🗓️',
      ARTISAN_ACTIVATED: '✅',
      ARTISAN_SUSPENDED: '⚠️',
      BOOKING_RECEIVED: '📩',
      BOOKING_CONFIRMED: '✅',
      BOOKING_CANCELLED: '❌',
      BOOKING_COMPLETED: '🎉',
      REVIEW_RECEIVED: '⭐',
      PROMOTION_STARTED: '🚀',
      PROMOTION_EXPIRED: '⏰',
      THREAD_NEW_INQUIRY: '💬',
      THREAD_NEW_MESSAGE: '✉️',
      THREAD_PROPOSAL_RECEIVED: '📋',
      THREAD_PROPOSAL_ACCEPTED: '✅',
      THREAD_PROPOSAL_DECLINED: '❌',
      PAYMENT_SENT_CONFIRMED: '💸',
      PAYMENT_RECEIVED_CONFIRMED: '💰',
      PAYMENT_DISPUTED: '⚠️',
    };
    return map[type] || '🔔';
  }

  private getCategoryLabel(type: NotificationType): string {
    if (type.startsWith('THREAD_') || type.startsWith('BOOKING_'))
      return 'Bookings & Threads';
    if (type.startsWith('PAYMENT_')) return 'Payments';
    if (type.startsWith('WALLET_')) return 'Wallet';
    if (type.startsWith('CONTACT_')) return 'Contacts';
    if (type.startsWith('PROMOTION_')) return 'Promotions';
    if (type === 'CARD_INTERACTION') return 'Card Activity';
    if (type.startsWith('ARTISAN_')) return 'Artisan';
    if (type === 'MEETING_REQUEST') return 'Meetings';
    if (type === 'APPOINTMENT_BOOKED') return 'Appointments';
    if (type === 'REVIEW_RECEIVED') return 'Reviews';
    return 'Notification';
  }
}
