import { Test, TestingModule } from '@nestjs/testing';
import { CpAppointmentsService } from './cp-appointments.service';
import { DatabaseService } from '../../database/database.service';
import { CpAuditLogService } from '../audit-logs/cp-audit-log.service';
import { CpNotificationsService } from '../notifications/notifications.service';
import { ConflictException } from '@nestjs/common';
import { CpAppointmentStatus, CpNotificationType } from '../../generated/prisma/client';
import { Request } from 'express';

describe('CpAppointmentsService', () => {
  let service: CpAppointmentsService;
  let db: any;
  let auditLog: any;
  let notifications: any;

  beforeEach(async () => {
    db = {
      cpAppointment: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      cpClient: {
        findUnique: jest.fn(),
      },
      cpCompanyProfile: {
        findUnique: jest.fn(),
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
        CpAppointmentsService,
        { provide: DatabaseService, useValue: db },
        { provide: CpAuditLogService, useValue: auditLog },
        { provide: CpNotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get<CpAppointmentsService>(CpAppointmentsService);
  });

  describe('updateStatus', () => {
    const mockCtx = { workspaceId: 'ws-1', organizationId: 'org-1' } as any;
    const mockReq = {} as Request;
    const mockApptId = 'appt-1';

    const testTransition = async (from: CpAppointmentStatus, to: CpAppointmentStatus, shouldPass: boolean) => {
      db.cpAppointment.findFirst.mockResolvedValue({ id: mockApptId, status: from });
      db.cpAppointment.update.mockResolvedValue({ id: mockApptId, status: to });

      if (shouldPass) {
        await expect(service.updateStatus(mockCtx, mockApptId, { status: to }, mockReq)).resolves.not.toThrow();
        expect(db.cpAppointment.update).toHaveBeenCalled();
      } else {
        await expect(service.updateStatus(mockCtx, mockApptId, { status: to }, mockReq)).rejects.toThrow(ConflictException);
        expect(db.cpAppointment.update).not.toHaveBeenCalled();
      }
      jest.clearAllMocks();
    };

    it('allows valid transitions', async () => {
      await testTransition(CpAppointmentStatus.PENDING, CpAppointmentStatus.CONFIRMED, true);
      await testTransition(CpAppointmentStatus.PENDING, CpAppointmentStatus.CANCELLED, true);
      await testTransition(CpAppointmentStatus.PENDING, CpAppointmentStatus.RESCHEDULED, true);

      await testTransition(CpAppointmentStatus.CONFIRMED, CpAppointmentStatus.COMPLETED, true);
      await testTransition(CpAppointmentStatus.CONFIRMED, CpAppointmentStatus.CANCELLED, true);
      await testTransition(CpAppointmentStatus.CONFIRMED, CpAppointmentStatus.NO_SHOW, true);
      await testTransition(CpAppointmentStatus.CONFIRMED, CpAppointmentStatus.RESCHEDULED, true);

      await testTransition(CpAppointmentStatus.RESCHEDULED, CpAppointmentStatus.CONFIRMED, true);
      await testTransition(CpAppointmentStatus.RESCHEDULED, CpAppointmentStatus.COMPLETED, true);
      await testTransition(CpAppointmentStatus.RESCHEDULED, CpAppointmentStatus.CANCELLED, true);
    });

    it('rejects invalid transitions', async () => {
      await testTransition(CpAppointmentStatus.PENDING, CpAppointmentStatus.COMPLETED, false);
      await testTransition(CpAppointmentStatus.PENDING, CpAppointmentStatus.NO_SHOW, false);

      await testTransition(CpAppointmentStatus.COMPLETED, CpAppointmentStatus.PENDING, false);
      await testTransition(CpAppointmentStatus.COMPLETED, CpAppointmentStatus.CONFIRMED, false);
      await testTransition(CpAppointmentStatus.COMPLETED, CpAppointmentStatus.CANCELLED, false);

      await testTransition(CpAppointmentStatus.CANCELLED, CpAppointmentStatus.COMPLETED, false);
      await testTransition(CpAppointmentStatus.CANCELLED, CpAppointmentStatus.CONFIRMED, false);

      await testTransition(CpAppointmentStatus.NO_SHOW, CpAppointmentStatus.RESCHEDULED, false);
    });

    it('allows identical status updates (no-op logically)', async () => {
      await testTransition(CpAppointmentStatus.CANCELLED, CpAppointmentStatus.CANCELLED, true);
    });
  });

  describe('update', () => {
    const mockCtx = { workspaceId: 'ws-1', organizationId: 'org-1' } as any;
    const mockReq = {} as Request;
    const mockApptId = 'appt-1';
    const oldDate = new Date('2026-07-20T10:00:00Z');
    const newDate = new Date('2026-07-21T10:00:00Z');

    it('auto-reschedules and sends notification when scheduledAt changes', async () => {
      db.cpAppointment.findFirst.mockImplementation((args: any) => {
        if (args?.where?.id?.not) return Promise.resolve(null);
        return Promise.resolve({
          id: mockApptId,
          status: CpAppointmentStatus.CONFIRMED,
          scheduledAt: oldDate,
          staffId: 'staff-1',
        });
      });
      db.cpAppointment.update.mockResolvedValue({
        id: mockApptId,
        title: 'Checkup',
        status: CpAppointmentStatus.RESCHEDULED,
        clientId: 'client-1',
      });
      db.cpClient.findUnique.mockResolvedValue({ authUserId: 'auth-client-1' });

      await service.update(mockCtx, mockApptId, { scheduledAt: newDate.toISOString() }, mockReq);

      expect(db.cpAppointment.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          status: CpAppointmentStatus.RESCHEDULED,
          scheduledAt: newDate,
        }),
      }));
      expect(notifications.send).toHaveBeenCalledWith(expect.objectContaining({
        type: CpNotificationType.APPOINTMENT_RESCHEDULED,
        recipientAuthId: 'auth-client-1',
      }));
    });

    it('does not auto-reschedule if scheduledAt is identical', async () => {
      db.cpAppointment.findFirst.mockImplementation((args: any) => {
        if (args?.where?.id?.not) return Promise.resolve(null);
        return Promise.resolve({
          id: mockApptId,
          status: CpAppointmentStatus.CONFIRMED,
          scheduledAt: oldDate,
          staffId: 'staff-1',
        });
      });
      db.cpAppointment.update.mockResolvedValue({ id: mockApptId });

      await service.update(mockCtx, mockApptId, { scheduledAt: oldDate.toISOString() }, mockReq);

      expect(db.cpAppointment.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          scheduledAt: oldDate,
        }),
      }));
      expect(db.cpAppointment.update.mock.calls[0][0].data.status).toBeUndefined();
      expect(notifications.send).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    const mockCtx = { workspaceId: 'ws-1', organizationId: 'org-1' } as any;
    const mockReq = {} as Request;

    it('uses custom default duration from cpCompanyProfile for conflict detection', async () => {
      // Return custom duration of 30 minutes
      db.cpCompanyProfile.findUnique.mockResolvedValue({
        appointmentDefaults: { duration: 30 },
      });
      // Mock conflicting to be true to throw an error
      db.cpAppointment.findFirst.mockResolvedValue({ id: 'conflicting-appt' });

      await expect(
        service.create(
          mockCtx,
          { title: 'New appt', scheduledAt: '2026-07-20T10:00:00Z', staffId: 'staff-1' } as any,
          mockReq,
        ),
      ).rejects.toThrow(ConflictException);

      // Verify that findFirst was called with the 30 min (1800000 ms) window
      const findArgs = db.cpAppointment.findFirst.mock.calls[0][0];
      const scheduledAt = new Date('2026-07-20T10:00:00Z');
      const expectedEndsAt = new Date(scheduledAt.getTime() + 30 * 60 * 1000);

      expect(findArgs.where.AND[0].scheduledAt.lt).toEqual(expectedEndsAt);
    });
  });
});
