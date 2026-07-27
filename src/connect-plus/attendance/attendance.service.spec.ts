import { Test, TestingModule } from '@nestjs/testing';
import { CpAttendanceService } from './attendance.service';
import { DatabaseService } from '../../database/database.service';
import { CpAuditLogService } from '../audit-logs/cp-audit-log.service';
import { CpNotificationsService } from '../notifications/notifications.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CpRole } from '../../generated/prisma/client';
import { Request } from 'express';

describe('CpAttendanceService', () => {
  let service: CpAttendanceService;
  let db: any;
  let auditLog: any;
  let notifications: any;

  beforeEach(async () => {
    db = {
      cpStaffProfile: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      cpAttendance: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      cpCompanyProfile: {
        findUnique: jest.fn(),
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
        CpAttendanceService,
        { provide: DatabaseService, useValue: db },
        { provide: CpAuditLogService, useValue: auditLog },
        { provide: CpNotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get<CpAttendanceService>(CpAttendanceService);
  });

  describe('checkIn', () => {
    const mockCtx = {
      workspaceId: 'ws-1',
      memberId: 'mem-1',
      authUserId: 'user-1',
      organizationId: 'org-1',
    } as any;
    const mockReq = {} as Request;

    it('throws ConflictException if already checked in for today', async () => {
      db.cpStaffProfile.findUnique.mockResolvedValue({ id: 'staff-1', name: 'John Doe' });
      db.cpAttendance.findUnique.mockResolvedValue({ id: 'att-1' });

      await expect(service.checkIn(mockCtx, {}, mockReq)).rejects.toThrow(
        ConflictException,
      );

      expect(db.cpAttendance.create).not.toHaveBeenCalled();
    });

    it('creates attendance record and triggers audit/notifications when checking in for the first time', async () => {
      db.cpStaffProfile.findUnique.mockResolvedValue({ id: 'staff-1', name: 'John Doe' });
      db.cpAttendance.findUnique.mockResolvedValue(null);
      db.cpCompanyProfile.findUnique.mockResolvedValue({ businessHours: null });
      db.cpAttendance.create.mockResolvedValue({
        id: 'att-1',
        staffId: 'staff-1',
        isLate: false,
      });

      const result = await service.checkIn(mockCtx, {}, mockReq);

      expect(result.id).toBe('att-1');
      expect(db.cpAttendance.create).toHaveBeenCalled();
      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'ATTENDANCE_CHECK_IN',
        }),
      );
      expect(notifications.send).toHaveBeenCalled();
    });
  });

  describe('override', () => {
    const mockCtx = {
      workspaceId: 'ws-1',
      authUserId: 'admin-1',
      organizationId: 'org-1',
      role: CpRole.WORKSPACE_ADMIN,
    } as any;
    const mockReq = {} as Request;

    it('throws NotFoundException if attendance record is not in the workspace', async () => {
      db.cpAttendance.findFirst.mockResolvedValue(null);

      await expect(
        service.override(mockCtx, 'att-1', { overrideReason: 'System down' }, mockReq),
      ).rejects.toThrow(NotFoundException);

      expect(db.cpAttendance.update).not.toHaveBeenCalled();
    });

    it('updates attendance times, recalculates hours/overtime, and writes override audit log', async () => {
      const originalRecord = {
        id: 'att-1',
        workspaceId: 'ws-1',
        checkIn: new Date('2026-07-21T08:00:00Z'),
        checkOut: null,
        hoursWorked: null,
        isOvertime: false,
      };

      db.cpAttendance.findFirst.mockResolvedValue(originalRecord);
      db.cpCompanyProfile.findUnique.mockResolvedValue({ businessHours: null });
      db.cpAttendance.update.mockResolvedValue({
        ...originalRecord,
        checkOut: new Date('2026-07-21T18:00:00Z'),
        hoursWorked: 10,
        isOvertime: true,
        overriddenBy: 'admin-1',
      });

      const result = await service.override(
        mockCtx,
        'att-1',
        {
          checkIn: '2026-07-21T08:00:00Z',
          checkOut: '2026-07-21T18:00:00Z',
          overrideReason: 'Forgot to check out',
        },
        mockReq,
      );

      expect(db.cpAttendance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'att-1' },
          data: expect.objectContaining({
            hoursWorked: 10,
            isOvertime: true,
            overriddenBy: 'admin-1',
            overrideReason: 'Forgot to check out',
          }),
        }),
      );

      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'ATTENDANCE_OVERRIDE',
          action: 'UPDATE',
        }),
      );
    });
  });
});
