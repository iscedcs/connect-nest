import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DatabaseService } from '../../database/database.service';
import { CpAuditLogService } from '../audit-logs/cp-audit-log.service';
import { CpNotificationsService } from '../notifications/notifications.service';
import {
  CpInvoiceStatus,
  CpNotificationType,
  CpRole,
  CpMemberStatus,
} from '../../generated/prisma/client';

@Injectable()
export class CpInvoicesScheduler {
  private readonly logger = new Logger(CpInvoicesScheduler.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly auditLog: CpAuditLogService,
    private readonly notifications: CpNotificationsService,
  ) {}

  @Cron('0 1 * * *', { name: 'invoice-overdue-sweep', timeZone: 'UTC' })
  async markOverdue(): Promise<void> {
    const now = new Date();

    const invoices = await this.db.cpInvoice.findMany({
      where: {
        status: CpInvoiceStatus.SENT,
        dueDate: { lte: now },
        deletedAt: null,
      },
      include: {
        client: { include: { member: true } },
        workspace: true,
        createdByStaff: { include: { member: true } },
      },
    });

    if (!invoices.length) {
      this.logger.debug('No overdue invoices found');
      return;
    }

    for (const invoice of invoices) {
      try {
        const updated = await this.db.cpInvoice.update({
          where: { id: invoice.id },
          data: { status: CpInvoiceStatus.OVERDUE, overdueAt: now },
        });

        this.auditLog.write({
          ctx: null,
          workspaceId: invoice.workspaceId,
          eventType: 'INVOICE_OVERDUE',
          targetEntity: 'CpInvoice',
          targetEntityId: invoice.id,
          action: 'UPDATE',
          before: invoice,
          after: updated,
        });

        const recipients = new Set<string>();
        if (invoice.client.member?.authUserId)
          recipients.add(invoice.client.member.authUserId);
        if (invoice.createdByStaff?.member?.authUserId)
          recipients.add(invoice.createdByStaff.member.authUserId);

        const admins = await this.db.cpWorkspaceMember.findMany({
          where: {
            workspaceId: invoice.workspaceId,
            role: CpRole.WORKSPACE_ADMIN,
            status: CpMemberStatus.ACTIVE,
          },
          select: { authUserId: true },
        });
        admins.forEach((admin) => {
          if (admin.authUserId) recipients.add(admin.authUserId);
        });

        for (const recipientAuthId of recipients) {
          this.notifications.send({
            recipientAuthId,
            type: CpNotificationType.INVOICE_OVERDUE,
            title: `Invoice ${invoice.invoiceNumber} is overdue`,
            message: `Invoice ${invoice.invoiceNumber} has passed its due date.`,
            workspaceId: invoice.workspaceId,
          });
        }
      } catch (error) {
        this.logger.error(
          `Failed to mark invoice ${invoice.id} overdue`,
          error as Error,
        );
      }
    }
  }
}
