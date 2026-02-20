import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

const FROM = 'ISCE Connect <no-reply@isce.africa>';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend = new Resend(process.env.RESEND_API_KEY);

  private async deliver(msg: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<void> {
    try {
      await this.resend.emails.send({
        from: FROM,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      });
      this.logger.log(`[Mail] Resend → ${msg.to} (${msg.subject})`);
    } catch (err) {
      this.logger.error(
        `[Mail] Resend failed for ${msg.to}: ${(err as Error).message}`,
      );
    }
  }

  /** Fire-and-forget — caller does NOT need to await */
  sendResetPasswordEmail(to: string, resetCode: string): void {
    void this.deliver({
      to,
      subject: 'Reset Your Password',
      text: `Here is your Reset Code: ${resetCode}`,
      html: `<p>Here is your Reset Code <strong>${resetCode}</strong> to reset your password.</p>`,
    });
  }

  /** Fire-and-forget */
  sendAdminCodeEmail(to: string, code: string): void {
    const newUrl = `${process.env.FRONTEND_URL}/register/admin`;
    void this.deliver({
      to,
      subject: 'ADMIN REGISTRATION CODE',
      text: `Here is your Admin Registration Code: ${code} to register your Admin account, it expires in 2 days. Click on this link to continue your registration: ${newUrl}`,
      html: `<p>Here is your Admin Registration Code <strong>${code}</strong> to register your Admin account, it expires in 2 days. Click on this link to continue your registration: <a href="${newUrl}">${newUrl}</a></p>`,
    });
  }

  /** Fire-and-forget */
  sendAgentPassword(to: string, password: string): void {
    const newUrl = `${process.env.FRONTEND_URL}/sign-in`;
    void this.deliver({
      to,
      subject: 'AGENT PASSWORD SENT',
      text: `Here is your ISCE Connect Agent account password: ${password}. Click on this link to signin: ${newUrl}`,
      html: `<p>Here is your ISCE Connect Agent account password: <strong>${password}</strong>. Click on this link to signin: <a href="${newUrl}">${newUrl}</a></p>`,
    });
  }

  /** Fire-and-forget */
  sendVerifyEmail(to: string, code: string): void {
    void this.deliver({
      to,
      subject: 'VERIFY EMAIL CODE',
      text: `Here is your Verify Email Code: ${code}`,
      html: `<p>Here is your Email Verification Code <strong>${code}</strong> to verify your email, it expires in 5 minutes.</p>`,
    });
  }
}
