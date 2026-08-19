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

export interface SendSubscriptionLaunchOptions {
  to: string;
  recipientName?: string;
  trialMonths?: number;
  trialEndDate?: Date;
  dashboardUrl?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly fromAddress: string;
  private readonly appUrl: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    // Send from the already-verified isce.app domain (SPF/DKIM/DMARC in place).
    // The LYNCON rebrand changes the display name only — moving the sending domain
    // to lyncon.app needs its DNS records verified in Resend first.
    this.fromAddress =
      process.env.RESEND_FROM_EMAIL || 'LYNCON <lyncon@isce.app>';
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

  /**
   * Send the official LYNCON Rebrand & 6-Month Free Trial Launch Announcement Email.
   */
  async sendSubscriptionLaunchEmail(
    options: SendSubscriptionLaunchOptions,
  ): Promise<boolean> {
    if (!this.resend) {
      this.logger.warn(
        `RESEND_API_KEY not set — skipped launch email to ${options.to}`,
      );
      return false;
    }

    try {
      const html = this.buildSubscriptionLaunchHtml(options);

      await this.resend.emails.send({
        from: this.fromAddress,
        to: options.to,
        subject: '🚀 Welcome to LYNCON: Your 6-Month Free Trial is Active!',
        html,
      });

      this.logger.log(`Subscription launch email sent to ${options.to}`);
      return true;
    } catch (err) {
      this.logger.error(
        `Failed to send subscription launch email to ${options.to}`,
        err,
      );
      return false;
    }
  }

  private buildEmailHtml(options: SendEmailOptions): string {
    const { recipientName, title, message, type, actionUrl, actionLabel } =
      options;
    const greeting = recipientName ? `Hi ${recipientName},` : 'Hi there,';
    const icon = this.getEmojiForType(type);
    const category = this.getCategoryLabel(type);
    const btnUrl = actionUrl || this.appUrl;
    const btnLabel = actionLabel || 'Open LYNCON';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0d0d12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d12;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#16161f;border:1px solid #262635;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.4);">
          <!-- Header -->
          <tr>
            <td style="padding:28px 24px 20px;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#d946ef 100%);text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">LYNCON</h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;">Formerly ISCE Connect • ${category}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:28px 24px;">
              <p style="margin:0 0 16px;color:#f1f1f5;font-size:15px;font-weight:500;">${greeting}</p>
              <div style="background:#1f1f2e;border-radius:10px;padding:18px;border-left:4px solid #6366f1;">
                <p style="margin:0 0 6px;color:#ffffff;font-size:15px;font-weight:600;">${icon} ${title}</p>
                <p style="margin:0;color:#a8a8b8;font-size:14px;line-height:1.6;">${message}</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
                <tr>
                  <td align="center">
                    <a href="${btnUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;box-shadow:0 4px 12px rgba(99,102,241,0.3);">${btnLabel}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 24px;border-top:1px solid #222233;text-align:center;background:#12121a;">
              <p style="margin:0;color:#717182;font-size:12px;line-height:1.5;">You received this update because you have an active account on <strong>LYNCON</strong> (formerly ISCE Connect).</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
  }

  private buildSubscriptionLaunchHtml(
    options: SendSubscriptionLaunchOptions,
  ): string {
    const { recipientName, trialMonths = 6, trialEndDate, dashboardUrl } =
      options;
    const greeting = recipientName ? `Hi ${recipientName},` : 'Hello,';
    const targetUrl = dashboardUrl || `${this.appUrl}/subscriptions`;

    const formattedEndDate = trialEndDate
      ? trialEndDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'in 6 months';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Welcome to LYNCON & Your 6-Month Free Trial</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;background:#13131c;border:1px solid #232336;border-radius:20px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.6);">
          
          <!-- Gradient Top Brand Header -->
          <tr>
            <td style="padding:36px 30px 28px;background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 50%,#c026d3 100%);text-align:center;">
              <div style="display:inline-block;background:rgba(255,255,255,0.18);padding:4px 14px;border-radius:20px;margin-bottom:12px;border:1px solid rgba(255,255,255,0.25);">
                <span style="color:#ffffff;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Important Product Announcement</span>
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:32px;font-weight:900;letter-spacing:-0.5px;">LYNCON</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.9);font-size:14px;font-weight:500;">ISCE Connect is evolving into something bigger.</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding:32px 30px;">
              <p style="margin:0 0 16px;color:#ffffff;font-size:16px;font-weight:600;">${greeting}</p>
              
              <p style="margin:0 0 18px;color:#c4c4d4;font-size:14px;line-height:1.6;">
                We are thrilled to announce that <strong>ISCE Connect</strong> is officially rebranded to <strong>LYNCON</strong>! Along with our new name and enhanced experience, we are launching our dynamic subscription plans tailored to give you maximum flexibility.
              </p>

              <!-- Highlight Box: 6-Month Free Trial -->
              <div style="background:linear-gradient(135deg,#1c1b2f 0%,#181828 100%);border-radius:14px;padding:22px;border:1px solid #3b3663;margin-bottom:24px;">
                <div style="display:flex;align-items:center;margin-bottom:10px;">
                  <span style="font-size:22px;margin-right:8px;">🎁</span>
                  <h2 style="margin:0;color:#a5b4fc;font-size:17px;font-weight:700;">Your ${trialMonths}-Month Free Trial is Now Active</h2>
                </div>
                <p style="margin:0 0 12px;color:#e0e0ec;font-size:13px;line-height:1.6;">
                  As a thank-you for being a pioneer of our community, you have been automatically enrolled in a <strong>${trialMonths}-Month Free Trial</strong> with full access to elevated features until <strong>${formattedEndDate}</strong>.
                </p>
                <ul style="margin:0;padding-left:20px;color:#a5b4fc;font-size:13px;line-height:1.6;">
                  <li>Multi-profile & enhanced social connectivity</li>
                  <li>Custom themes, branding, and booking tools</li>
                  <li>High-speed file storage and priority integrations</li>
                </ul>
              </div>

              <!-- Clarity on Expiration & Billing -->
              <h3 style="margin:0 0 8px;color:#ffffff;font-size:15px;font-weight:700;">What happens when your trial ends?</h3>
              <p style="margin:0 0 20px;color:#a8a8b8;font-size:13px;line-height:1.6;">
                Transparency is our priority. When your trial period concludes on <strong>${formattedEndDate}</strong>, you will have the choice to subscribe to a paid tier (such as <em>Pro Lite</em> or <em>Pro Plus</em>) to continue using premium quotas, or seamlessly switch to our generous <strong>Free tier</strong>. You will never be charged without your explicit setup and confirmation.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 12px;">
                <tr>
                  <td align="center">
                    <a href="${targetUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);color:#ffffff;text-decoration:none;padding:14px 38px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.3px;box-shadow:0 6px 20px rgba(99,102,241,0.4);">Explore Your LYNCON Account</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 30px;border-top:1px solid #1e1e2d;background:#0d0d14;text-align:center;">
              <p style="margin:0 0 6px;color:#888899;font-size:12px;font-weight:600;">LYNCON — Next-Generation Networking & Business Suite</p>
              <p style="margin:0;color:#555566;font-size:11px;">You received this notification as a registered user of LYNCON (formerly ISCE Connect).</p>
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
      SUBSCRIPTION_TRIAL_EXPIRED: '⏳',
      SUBSCRIPTION_ACTIVATED: '🎉',
      SUBSCRIPTION_CANCELLED: '🚫',
      SUBSCRIPTION_PAST_DUE: '⚠️',
      SUBSCRIPTION_LAUNCH_ANNOUNCEMENT: '🚀',
    };
    return map[type] || '🔔';
  }

  private getCategoryLabel(type: NotificationType): string {
    if (type === 'SUBSCRIPTION_LAUNCH_ANNOUNCEMENT') return 'Special Announcement';
    if (type.startsWith('SUBSCRIPTION_')) return 'Subscription';
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
