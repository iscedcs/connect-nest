import { Test, TestingModule } from '@nestjs/testing';
import { CpInvoicesService } from './invoices.service';
import { DatabaseService } from '../../database/database.service';
import { CpAuditLogService } from '../audit-logs/cp-audit-log.service';
import { CpNotificationsService } from '../notifications/notifications.service';
import { ForbiddenException } from '@nestjs/common';
import { CpInvoiceStatus, CpRole } from '../../generated/prisma/client';
import { Request } from 'express';

describe('CpInvoicesService', () => {
  let service: CpInvoicesService;
  let db: any;
  let auditLog: any;
  let notifications: any;

  beforeEach(async () => {
    db = {
      cpInvoice: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      cpInvoiceItem: {
        deleteMany: jest.fn(),
      },
      cpCompanyProfile: {
        findUnique: jest.fn(),
      },
      cpClient: {
        findFirst: jest.fn(),
      },
      cpStaffProfile: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(db)),
    };

    auditLog = {
      write: jest.fn(),
    };

    notifications = {
      send: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CpInvoicesService,
        { provide: DatabaseService, useValue: db },
        { provide: CpAuditLogService, useValue: auditLog },
        { provide: CpNotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get<CpInvoicesService>(CpInvoicesService);
  });

  describe('update', () => {
    const mockCtx = { workspaceId: 'ws-1', role: CpRole.WORKSPACE_ADMIN } as any;
    const mockReq = {} as Request;

    it('throws ForbiddenException when updating a non-DRAFT invoice', async () => {
      db.cpInvoice.findFirst.mockResolvedValue({
        id: 'inv-1',
        status: CpInvoiceStatus.SENT,
        items: [],
      });

      await expect(
        service.update(mockCtx, 'inv-1', { notes: 'new notes' }, mockReq),
      ).rejects.toThrow(ForbiddenException);

      expect(db.cpInvoice.update).not.toHaveBeenCalled();
    });

    it('allows updating a DRAFT invoice', async () => {
      const mockInvoice = {
        id: 'inv-1',
        status: CpInvoiceStatus.DRAFT,
        workspaceId: 'ws-1',
        invoiceNumber: 'INV-123',
        currency: 'NGN',
        items: [],
      };
      db.cpInvoice.findFirst.mockResolvedValue(mockInvoice);
      db.cpStaffProfile.findFirst.mockResolvedValue({ id: 'staff-1' });
      db.cpCompanyProfile.findUnique.mockResolvedValue({ invoiceDefaults: null });
      db.cpInvoice.update.mockResolvedValue({ ...mockInvoice, notes: 'updated' });

      const result = await service.update(
        mockCtx,
        'inv-1',
        { notes: 'updated', items: [] },
        mockReq,
      );

      expect(result.notes).toBe('updated');
      expect(db.cpInvoice.update).toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    const mockCtx = { workspaceId: 'ws-1', role: CpRole.WORKSPACE_ADMIN } as any;
    const mockReq = {} as Request;

    it('throws ForbiddenException when cancelling a PAID invoice', async () => {
      db.cpInvoice.findFirst.mockResolvedValue({
        id: 'inv-1',
        status: CpInvoiceStatus.PAID,
        workspaceId: 'ws-1',
        items: [],
        client: {},
      });

      await expect(service.cancel(mockCtx, 'inv-1', mockReq)).rejects.toThrow(
        ForbiddenException,
      );

      expect(db.cpInvoice.update).not.toHaveBeenCalled();
    });

    it('allows cancelling a non-PAID invoice', async () => {
      db.cpInvoice.findFirst.mockResolvedValue({
        id: 'inv-1',
        status: CpInvoiceStatus.SENT,
        workspaceId: 'ws-1',
        items: [],
        client: {},
      });
      db.cpInvoice.update.mockResolvedValue({
        id: 'inv-1',
        status: CpInvoiceStatus.CANCELLED,
        client: {},
      });

      const result = await service.cancel(mockCtx, 'inv-1', mockReq);

      expect(result.status).toBe(CpInvoiceStatus.CANCELLED);
      expect(db.cpInvoice.update).toHaveBeenCalled();
    });
  });

  describe('markPaid', () => {
    const mockCtx = { workspaceId: 'ws-1', role: CpRole.WORKSPACE_ADMIN } as any;
    const mockReq = {} as Request;

    it('throws ForbiddenException when marking an already PAID invoice as paid', async () => {
      db.cpInvoice.findFirst.mockResolvedValue({
        id: 'inv-1',
        status: CpInvoiceStatus.PAID,
        workspaceId: 'ws-1',
        items: [],
        client: {},
      });

      await expect(
        service.markPaid(mockCtx, 'inv-1', { paidVia: 'cash' }, mockReq),
      ).rejects.toThrow(ForbiddenException);

      expect(db.cpInvoice.update).not.toHaveBeenCalled();
    });
  });
});
