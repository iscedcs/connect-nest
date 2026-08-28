import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DatabaseService } from '../../database/database.service';
import { CpNotificationsService } from '../notifications/notifications.service';
import { MailClientService } from '../../mail/mail-client.service';
import { CpAppointmentsService } from './cp-appointments.service';
import {
  CpAppointmentStatus,
  CpNotificationType,
} from '../../generated/prisma/client';
import { withDbRetry } from '../../common/utils/db-retry.util';

@Injectable()
export class AppointmentsScheduler {
  private readonly logger = new Logger(AppointmentsScheduler.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: CpNotificationsService,
    private readonly mailClient: MailClientService,
    private readonly appointmentsService: CpAppointmentsService,
  ) {}

  @Cron('0 8 * * *', { name: 'appointment-reminders', timeZone: 'UTC' })
  async sendReminders(): Promise<void> {
    this.logger.log('Running appointment reminders CRON');

    try {
      // Find appointments in a 23–25h window (tomorrow roughly) that haven't had reminders sent
      const now = new Date();
      const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
      const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);

      const appointments = await withDbRetry(
        () =>
          this.db.cpAppointment.findMany({
            where: {
              scheduledAt: { gte: windowStart, lte: windowEnd },
              status: {
                in: [CpAppointmentStatus.PENDING, CpAppointmentStatus.CONFIRMED],
              },
              reminderSentAt: null,
              deletedAt: null,
            },
            include: {
              client: { select: { email: true, authUserId: true, name: true } },
              staff: { select: { email: true, authUserId: true, name: true } },
              workspace: { select: { name: true } },
            },
          }),
        { logger: this.logger, label: 'sendReminders.findMany' },
      );

      if (!appointments.length) {
        this.logger.debug('Appointment reminders: no appointments in window');
        return;
      }

    await Promise.all(
      appointments.map(async (appt) => {
        try {
          const recipientEmail =
            appt.client?.email ?? appt.staff?.email ?? null;
          const recipientAuthId =
            appt.client?.authUserId ?? appt.staff?.authUserId ?? null;
          const recipientName =
            appt.client?.name ?? appt.staff?.name ?? 'there';

          // Email reminder
          if (recipientEmail) {
            await this.mailClient
              .sendEmail({
                to: recipientEmail,
                subject: `Reminder: ${appt.title}`,
                html: `<p>Hi ${recipientName},</p><p>This is a reminder for your appointment <strong>${appt.title}</strong> scheduled at ${appt.scheduledAt.toISOString()} with ${appt.workspace.name}.</p>`,
                text: `Reminder: ${appt.title} at ${appt.scheduledAt.toISOString()} with ${appt.workspace.name}.`,
              })
              .catch((err: unknown) =>
                this.logger.warn(
                  `Reminder email failed for appt ${appt.id}`,
                  err,
                ),
              );
          }

          // In-app notification
          if (recipientAuthId) {
            this.notifications.send({
              recipientAuthId,
              type: CpNotificationType.APPOINTMENT_REMINDER,
              title: `Reminder: ${appt.title}`,
              message: `Your appointment "${appt.title}" is scheduled tomorrow.`,
              workspaceId: appt.workspaceId,
            });
          }

          // Mark reminder as sent (prevent duplicates)
          await this.db.cpAppointment.update({
            where: { id: appt.id },
            data: { reminderSentAt: new Date() },
          });
        } catch (err) {
          this.logger.error(`Reminder failed for appointment ${appt.id}`, err);
        }
      }),
    );

      this.logger.log(
        `Appointment reminders: sent for ${appointments.length} appointment(s)`,
      );
    } catch (err) {
      this.logger.error('Appointment reminders CRON failed', err);
    }
  }

  @Cron('0 * * * *', { name: 'appointment-no-show', timeZone: 'UTC' })
  async autoNoShowPastDue(): Promise<void> {
    this.logger.log('Running auto NO_SHOW transition CRON');

    try {
      const now = new Date();
      const profiles = await withDbRetry(
        () =>
          this.db.cpCompanyProfile.findMany({
            select: { workspaceId: true, appointmentDefaults: true },
          }),
        { logger: this.logger, label: 'autoNoShowPastDue.findMany' },
      );

    let processedCount = 0;

    await Promise.all(
      profiles.map(async (profile) => {
        try {
          const defaults = profile.appointmentDefaults as Record<string, unknown> | undefined;
          const gracePeriodMins = typeof defaults?.gracePeriod === 'number' ? defaults.gracePeriod : 24 * 60; // 24 hours default
          const gracePeriodMs = gracePeriodMins * 60 * 1000;
          const cutoffTime = new Date(now.getTime() - gracePeriodMs);

          const pastDueAppointments = await this.db.cpAppointment.findMany({
            where: {
              workspaceId: profile.workspaceId,
              deletedAt: null,
              status: { in: [CpAppointmentStatus.PENDING, CpAppointmentStatus.CONFIRMED] },
              OR: [
                { endsAt: { lt: cutoffTime } },
                { endsAt: null, scheduledAt: { lt: cutoffTime } }
              ]
            },
            select: { id: true }
          });

          for (const appt of pastDueAppointments) {
            await this.appointmentsService.markAsNoShowSystem(appt.id);
            processedCount++;
          }
        } catch (err) {
          this.logger.error(`Error processing NO_SHOW for workspace ${profile.workspaceId}`, err);
        }
      })
      );

      this.logger.log(`Finished auto NO_SHOW transition CRON. Processed ${processedCount} appointments.`);
    } catch (err) {
      this.logger.error('Auto NO_SHOW transition CRON failed', err);
    }
  }
}
