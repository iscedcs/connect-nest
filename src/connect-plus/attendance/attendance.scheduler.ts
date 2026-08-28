import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DatabaseService } from '../../database/database.service';
import { CpNotificationsService } from '../notifications/notifications.service';
import { CpAuditLogService } from '../audit-logs/cp-audit-log.service';
import { CpNotificationType, CpRole } from '../../generated/prisma/client';
import { withDbRetry } from '../../common/utils/db-retry.util';

@Injectable()
export class AttendanceScheduler {
  private readonly logger = new Logger(AttendanceScheduler.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: CpNotificationsService,
    private readonly auditLog: CpAuditLogService,
  ) {}

  @Cron('0 23 * * *', { name: 'attendance-auto-checkout', timeZone: 'UTC' })
  async autoCheckout(): Promise<void> {
    this.logger.log('Running auto-checkout CRON');

    try {
      // Find today's attendance records (UTC) that have not been checked out
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setUTCHours(23, 59, 59, 999);

      const records = await withDbRetry(
        () =>
          this.db.cpAttendance.findMany({
            where: {
              date: { gte: startOfDay, lte: endOfDay },
              checkIn: { not: null },
              checkOut: null,
            },
            include: {
              staff: { include: { member: { select: { authUserId: true } } } },
              workspace: {
                select: {
                  id: true,
                  organizationId: true,
                  companyProfile: { select: { businessHours: true } },
                },
              },
            },
          }),
        { logger: this.logger, label: 'autoCheckout.findMany' },
      );

      if (!records.length) {
        this.logger.debug('Auto-checkout: no open records found');
        return;
      }

    const now = new Date();

    await Promise.all(
      records.map(async (record) => {
        try {
          const checkInTime = record.checkIn.getTime();
          const checkOutTime = now.getTime();
          const hoursWorked = (checkOutTime - checkInTime) / 1000 / 3600;

          // Determine standard hours from workspace business hours (fallback: 9)
          const bhJson = record.workspace.companyProfile?.businessHours as
            | Array<{ day?: number; open?: string; close?: string; isOpen?: boolean }>
            | null
            | undefined;
          
          const dayOfWeek = record.checkIn.getUTCDay();
          const entry = bhJson?.find(e => e.day === dayOfWeek);

          // Estimate standard hours from business hours entry; fallback to 9
          const standardHours =
            entry?.isOpen && entry?.open && entry?.close
              ? (() => {
                  const [sh, sm] = entry.open.split(':').map(Number);
                  const [eh, em] = entry.close.split(':').map(Number);
                  return (eh * 60 + em - sh * 60 - sm) / 60;
                })()
              : 9;
          const isOvertime = hoursWorked > standardHours;

          await this.db.cpAttendance.update({
            where: { id: record.id },
            data: {
              checkOut: now,
              hoursWorked: Math.round(hoursWorked * 100) / 100,
              isOvertime,
              autoCheckedOut: true,
            },
          });

          // Notify workspace admins
          const admins = await this.db.cpWorkspaceMember.findMany({
            where: {
              workspaceId: record.workspaceId,
              role: CpRole.WORKSPACE_ADMIN,
            },
            select: { authUserId: true },
          });

          for (const admin of admins) {
            this.notifications.send({
              recipientAuthId: admin.authUserId,
              type: CpNotificationType.ATTENDANCE_OVERRIDE,
              title: 'Auto Checkout',
              message: `${record.staff.name} was automatically checked out at 23:00 UTC.`,
              workspaceId: record.workspaceId,
            });
          }

          this.auditLog.write({
            ctx: null,
            workspaceId: record.workspaceId,
            eventType: 'ATTENDANCE_AUTO_CHECKOUT',
            targetEntity: 'CpAttendance',
            targetEntityId: record.id,
            action: 'UPDATE',
            after: { checkOut: now, autoCheckedOut: true },
          });
        } catch (err) {
          this.logger.error(
            `Auto-checkout failed for record ${record.id}`,
            err,
          );
        }
      }),
    );

      this.logger.log(`Auto-checkout: processed ${records.length} record(s)`);
    } catch (err) {
      this.logger.error('Auto-checkout CRON failed', err);
    }
  }
}
