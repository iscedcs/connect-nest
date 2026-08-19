import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { NotificationType } from '../generated/prisma/client';
import { DatabaseService } from '../database/database.service';
import { PushService } from '../push/push.service';
import { AuthClientService } from '../auth/auth-client.service';
import { EmailService } from './email.service';
import { NotificationGateway } from './notification.gateway';

export interface DispatchOptions {
  /** Auth userId (from JWT payload `id`) — used for push + user lookup */
  userId: string;
  /** Profile ID (connect profile) — used for DB notification record */
  profileId?: string;
  type: NotificationType;
  title: string;
  message: string;
  /** Extra structured data for push payload */
  data?: Record<string, string>;
  /** Override action URL in email (default: app home) */
  actionUrl?: string;
  /** Override email button label */
  actionLabel?: string;
  /** Recipient email — pass from JWT context to avoid extra lookup */
  recipientEmail?: string;
  /** Recipient display name */
  recipientName?: string;
  /** Skip specific channels */
  skipEmail?: boolean;
  skipPush?: boolean;
  skipInApp?: boolean;
}

// Notification types that warrant an email
const EMAIL_WORTHY_TYPES: Set<NotificationType> = new Set([
  'BOOKING_RECEIVED',
  'BOOKING_CONFIRMED',
  'BOOKING_CANCELLED',
  'BOOKING_COMPLETED',
  'THREAD_PROPOSAL_RECEIVED',
  'THREAD_PROPOSAL_ACCEPTED',
  'THREAD_PROPOSAL_DECLINED',
  'PAYMENT_SENT_CONFIRMED',
  'PAYMENT_RECEIVED_CONFIRMED',
  'PAYMENT_DISPUTED',
  'APPOINTMENT_BOOKED',
  'WALLET_FUNDED',
  'WALLET_TRANSFER',
  'ARTISAN_ACTIVATED',
  'ARTISAN_SUSPENDED',
  'REVIEW_RECEIVED',
  'SUBSCRIPTION_LAUNCH_ANNOUNCEMENT',
  'SUBSCRIPTION_TRIAL_EXPIRED',
  'SUBSCRIPTION_ACTIVATED',
  'SUBSCRIPTION_PAST_DUE',
]);

@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly pushService: PushService,
    private readonly authClient: AuthClientService,
    private readonly emailService: EmailService,
    @Inject(forwardRef(() => NotificationGateway))
    private readonly gateway: NotificationGateway,
  ) {}

  /**
   * Dispatch a notification across all channels:
   * 1. In-app (DB record + WebSocket push)
   * 2. Push notification (FCM via PushService)
   * 3. Email (Resend, for important types only)
   *
   * Fire-and-forget — errors in any channel are logged, never thrown.
   */
  async dispatch(options: DispatchOptions): Promise<void> {
    const {
      userId,
      type,
      title,
      message,
      data,
      recipientEmail,
      recipientName,
      skipEmail,
      skipPush,
      skipInApp,
      actionUrl,
      actionLabel,
    } = options;

    let { profileId } = options;

    // Resolve profileId from userId if not provided
    if (!profileId) {
      try {
        const profile = await this.db.profile.findFirst({
          where: { userId },
          select: { id: true },
        });
        if (profile) {
          profileId = profile.id;
        }
      } catch {
        this.logger.warn(`Could not resolve profileId for user ${userId}`);
      }
    }

    // ── 1. In-App (DB + WebSocket) ──────────────────────
    if (!skipInApp && profileId) {
      try {
        const notification = await this.db.notification.create({
          data: {
            userId: profileId,
            title,
            message,
            type,
          },
        });

        // Push via WebSocket to the connected user
        this.gateway.emitNewNotification(userId, {
          id: notification.id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          isRead: false,
          createdAt: notification.createdAt.toISOString(),
        });

        // Also push updated unread count
        const unreadCount = await this.db.notification.count({
          where: {
            userId: profileId,
            isRead: false,
            deletedAt: null,
          },
        });
        this.gateway.emitUnreadCount(userId, unreadCount);
      } catch (err) {
        this.logger.error(
          `Failed to create in-app notification for user ${userId}`,
          err,
        );
      }
    }

    // ── 2. Push Notification (FCM) ──────────────────────
    if (!skipPush) {
      try {
        await this.pushService.sendToUser(userId, title, message, {
          type,
          ...(data || {}),
        });
      } catch (err) {
        this.logger.error(
          `Failed to send push notification to user ${userId}`,
          err,
        );
      }
    }

    // ── 3. Email ────────────────────────────────────────
    if (!skipEmail && EMAIL_WORTHY_TYPES.has(type)) {
      try {
        // Use email passed from caller (JWT context) or fetch from isce-auth
        let email = recipientEmail;
        let name = recipientName;

        if (!email) {
          // Fetch from isce-auth using the auth userId
          email = (await this.authClient.getUserEmail(userId)) ?? undefined;
        }

        if (!name && profileId) {
          const profile = await this.db.profile.findUnique({
            where: { id: profileId },
            select: { name: true },
          });
          name = profile?.name || undefined;
        }

        if (email) {
          await this.emailService.sendNotificationEmail({
            to: email,
            recipientName: name,
            type,
            title,
            message,
            actionUrl,
            actionLabel,
          });
        }
      } catch (err) {
        this.logger.error(
          `Failed to send email notification for user ${userId}`,
          err,
        );
      }
    }
  }

  /**
   * Convenience: dispatch to the "other" participant in a thread.
   * Looks up both participants and sends to the one that isn't `senderUserId`.
   */
  async dispatchToThreadRecipient(
    threadId: string,
    senderUserId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, string>,
  ): Promise<void> {
    try {
      const thread = await this.db.bookingThread.findUnique({
        where: { id: threadId },
        select: {
          clientUserId: true,
          clientProfileId: true,
          artisan: { select: { userId: true, profileId: true } },
        },
      });

      if (!thread) return;

      const recipientUserId =
        thread.clientUserId === senderUserId
          ? thread.artisan?.userId
          : thread.clientUserId;

      const recipientProfileId =
        thread.clientUserId === senderUserId
          ? thread.artisan?.profileId
          : thread.clientProfileId;

      if (!recipientUserId) return;

      await this.dispatch({
        userId: recipientUserId,
        profileId: recipientProfileId || undefined,
        type,
        title,
        message,
        data: {
          threadId,
          ...(data || {}),
        },
        actionUrl: `/connect/artisan/threads/${threadId}`,
        actionLabel: 'View Thread',
      });
    } catch (err) {
      this.logger.error(
        `Failed to dispatch thread notification for thread ${threadId}`,
        err,
      );
    }
  }
}
