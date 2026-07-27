import { Test, TestingModule } from '@nestjs/testing';
import { CpInvoicesScheduler } from './invoices.scheduler';
import { DatabaseService } from '../../database/database.service';
import { CpAuditLogService } from '../audit-logs/cp-audit-log.service';
import { CpNotificationsService } from '../notifications/notifications.service';
import { CpInvoiceStatus, CpRole, CpMemberStatus } from '../../generated/prisma/client';

describe('CpInvoicesScheduler', () => {
  let scheduler: CpInvoicesScheduler;
  let db: any;
  let auditLog: any;
  let notifications: any;

  beforeEach(async () => {
    db = {
      cpInvoice: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      cpWorkspaceMember: {
        findMany: jest.fn(),
      },
    };

    auditLog = {
      write: jest.fn(),
    };

    notifications = {
      send: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CpInvoicesScheduler,
        { provide: DatabaseService, useValue: db },
        { provide: CpAuditLogService, useValue: auditLog },
        { provide: CpNotificationsService, useValue: notifications },
      ],
    }).compile();

    scheduler = module.get<CpInvoicesScheduler>(CpInvoicesScheduler);
  });

  describe('markOverdue', () => {
    it('does nothing when no overdue invoices exist', async () => {
      db.cpInvoice.findMany.mockResolvedValue([]);

      await scheduler.markOverdue();

      expect(db.cpInvoice.update).not.toHaveBeenCalled();
      expect(auditLog.write).not.toHaveBeenCalled();
      expect(notifications.send).not.toHaveBeenCalled();
    });

    it('marks SENT invoices past due date as OVERDUE, registers audit log, and notifies stakeholders', async () => {
      const mockOverdueInvoice = {
        id: 'inv-1',
        workspaceId: 'ws-1',
        invoiceNumber: 'INV-123',
        status: CpInvoiceStatus.SENT,
        dueDate: new Date(Date.now() - 10000),
        client: {
          member: { authUserId: 'client-user-id' },
        },
        createdByStaff: {
          member: { authUserId: 'staff-user-id' },
        },
        workspace: { id: 'ws-1', name: 'Test WS' },
      };

      db.cpInvoice.findMany.mockResolvedValue([mockOverdueInvoice]);
      db.cpInvoice.update.mockResolvedValue({
        ...mockOverdueInvoice,
        status: CpInvoiceStatus.OVERDUE,
      });

      db.cpWorkspaceMember.findMany.mockResolvedValue([
        { authUserId: 'admin-user-id' },
      ]);

      await scheduler.markOverdue();

      expect(db.cpInvoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { status: CpInvoiceStatus.OVERDUE, overdueAt: expect.any(Date) },
      });

      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'INVOICE_OVERDUE',
          targetEntity: 'CpInvoice',
          targetEntityId: 'inv-1',
          action: 'UPDATE',
        }),
      );

      // Verify notifications sent to client, staff creator, and workspace admin
      expect(notifications.send).toHaveBeenCalledTimes(3);
      expect(notifications.send).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientAuthId: 'client-user-id',
          title: 'Invoice INV-123 is overdue',
        }),
      );
      expect(notifications.send).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientAuthId: 'staff-user-id',
          title: 'Invoice INV-123 is overdue',
        }),
      );
      expect(notifications.send).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientAuthId: 'admin-user-id',
          title: 'Invoice INV-123 is overdue',
        }),
      );
    });
  });
});
