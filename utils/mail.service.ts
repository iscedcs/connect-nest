import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as sgMail from '@sendgrid/mail';

const FROM = '"ISCE Connect" <isceofficial@gmail.com>';
const SENDGRID_TIMEOUT_MS = 5000;

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY as string);
    this.transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  /**
   * Internal: try SendGrid first (5s timeout), fall back to Gmail.
   * Never throws — errors are logged only.
   */
  private async deliver(msg: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<void> {
    const payload = { from: FROM, ...msg };

    // Try SendGrid first
    try {
      await Promise.race([
        sgMail.send(payload),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(`SendGrid timeout after ${SENDGRID_TIMEOUT_MS}ms`),
              ),
            SENDGRID_TIMEOUT_MS,
          ),
        ),
      ]);
      this.logger.log(`[Mail] SendGrid → ${msg.to} (${msg.subject})`);
      return;
    } catch (sgErr) {
      this.logger.warn(
        `[Mail] SendGrid failed for ${msg.to}: ${sgErr.message} — falling back to Gmail`,
      );
    }

    // Fall back to Gmail
    try {
      await this.transporter.sendMail(payload);
      this.logger.log(`[Mail] Gmail → ${msg.to} (${msg.subject})`);
    } catch (gmailErr) {
      this.logger.error(
        `[Mail] Gmail also failed for ${msg.to}: ${gmailErr.message}`,
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
