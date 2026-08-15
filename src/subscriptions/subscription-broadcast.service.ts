import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationDispatcher } from '../notification/notification-dispatcher.service';
import { EmailService } from '../notification/email.service';
import { AuthClientService } from '../auth/auth-client.service';
import { SubscriptionsService } from './subscriptions.service';
import { NotificationType, PlanTier } from '../generated/prisma/client';
import { BroadcastLaunchDto } from './dto/broadcast-launch.dto';

export interface BroadcastSummary {
  dryRun: boolean;
  totalCandidates: number;
  processed: number;
  emailsSent: number;
  inAppSent: number;
  errors: number;
  testEmailSent?: boolean;
}

@Injectable()
export class SubscriptionBroadcastService {
  private readonly logger = new Logger(SubscriptionBroadcastService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationDispatcher,
    private readonly emailService: EmailService,
    private readonly authClient: AuthClientService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  /**
   * Broadcast the LYNCON subscription launch announcement (email + in-app notification)
   * to existing users and auto-initialize their 6-month trial.
   */
  async broadcastLaunchAnnouncement(
    dto: BroadcastLaunchDto,
  ): Promise<BroadcastSummary> {
    const { dryRun = false, testEmail, limit = 100 } = dto;

    const trialMonths = 6;
    const now = new Date();
    const trialEndDate = new Date(now);
    trialEndDate.setMonth(trialEndDate.getMonth() + trialMonths);

    // ─── 1. Test Mode (Single email preview) ──────────────────────────────────
    if (testEmail) {
      this.logger.log(`Dispatching test launch announcement to ${testEmail}`);
      const sent = await this.emailService.sendSubscriptionLaunchEmail({
        to: testEmail,
        recipientName: 'Test Member',
        trialMonths,
        trialEndDate,
      });

      return {
        dryRun,
        totalCandidates: 1,
        processed: 1,
        emailsSent: sent ? 1 : 0,
        inAppSent: 0,
        errors: sent ? 0 : 1,
        testEmailSent: sent,
      };
    }

    // ─── 2. Find Candidates (Users with active profiles) ──────────────────────
    const profiles = await this.db.profile.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        userId: true,
        name: true,
      },
      distinct: ['userId'],
      take: limit,
    });

    const summary: BroadcastSummary = {
      dryRun,
      totalCandidates: profiles.length,
      processed: 0,
      emailsSent: 0,
      inAppSent: 0,
      errors: 0,
    };

    this.logger.log(
      `Found ${profiles.length} candidate users for LYNCON subscription rollout broadcast (dryRun=${dryRun})`,
    );

    for (const profile of profiles) {
      try {
        summary.processed++;

        // 1. Check or auto-bootstrap subscription record
        let sub = await this.db.subscription.findUnique({
          where: { userId: profile.userId },
        });

        if (!sub) {
          if (!dryRun) {
            sub = await this.subscriptionsService.createSubscription(
              profile.userId,
              PlanTier.FREE,
              true,
            );
          }
        }

        // Skip if already notified
        if (sub && sub.notifiedLaunch) {
          continue;
        }

        const effectiveEndDate = sub?.trialEndDate || trialEndDate;

        if (dryRun) {
          summary.emailsSent++;
          summary.inAppSent++;
          continue;
        }

        // 2. Dispatch In-App Notification & WebSocket event
        await this.notifications.dispatch({
          userId: profile.userId,
          profileId: profile.id,
          type: NotificationType.SUBSCRIPTION_LAUNCH_ANNOUNCEMENT,
          title: '🚀 Welcome to LYNCON: Your 6-Month Free Trial is Active!',
          message:
            'ISCE Connect is now LYNCON! Enjoy 6 months of elevated features on us. Learn more about our plans in your settings.',
          actionUrl: `${process.env.APP_URL || 'https://connect.isce.app'}/subscriptions`,
          actionLabel: 'View Subscription',
          skipEmail: true, // We send the dedicated rich HTML email directly below
        });
        summary.inAppSent++;

        // 3. Resolve user email & dispatch rich launch email
        const userEmail = await this.authClient.getUserEmail(profile.userId);
        if (userEmail) {
          const sent = await this.emailService.sendSubscriptionLaunchEmail({
            to: userEmail,
            recipientName: profile.name,
            trialMonths,
            trialEndDate: effectiveEndDate,
          });

          if (sent) {
            summary.emailsSent++;
          }
        }

        // 4. Mark user as notified in database
        if (sub) {
          await this.db.subscription.update({
            where: { id: sub.id },
            data: { notifiedLaunch: true },
          });
        }
      } catch (err) {
        summary.errors++;
        this.logger.error(
          `Error broadcasting launch to user ${profile.userId}`,
          err,
        );
      }
    }

    this.logger.log(
      `Broadcast completed: ${summary.emailsSent} emails sent, ${summary.inAppSent} in-app notifications, ${summary.errors} errors`,
    );

    return summary;
  }
}
