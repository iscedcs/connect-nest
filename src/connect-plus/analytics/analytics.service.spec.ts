import { Test, TestingModule } from '@nestjs/testing';
import { CpAnalyticsService } from './analytics.service';
import { DatabaseService } from '../../database/database.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CpRole } from '../../generated/prisma/client';

describe('CpAnalyticsService', () => {
  let service: CpAnalyticsService;
  let db: any;
  let cache: any;

  beforeEach(async () => {
    db = {
      cpAttendance: {
        count: jest.fn(),
        aggregate: jest.fn(),
        groupBy: jest.fn(),
      },
      cpClient: {
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      cpAppointment: {
        groupBy: jest.fn(),
      },
      cpLead: {
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      cpInvoice: {
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
      cpWorkspace: {
        findMany: jest.fn(),
      },
      cpStaffProfile: {
        findFirst: jest.fn(),
        groupBy: jest.fn(),
      },
    };

    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CpAnalyticsService,
        { provide: DatabaseService, useValue: db },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = module.get<CpAnalyticsService>(CpAnalyticsService);
  });

  describe('getAttendanceSummary', () => {
    it('returns correct aggregated attendance metrics for seeded data', async () => {
      const mockCtx = { workspaceId: 'ws-1' } as any;
      const mockQuery = { from: '2026-07-01', to: '2026-07-21' };

      // Mock database aggregate queries
      db.cpAttendance.count
        .mockResolvedValueOnce(10) // totalRecords
        .mockResolvedValueOnce(2)  // lateRecords
        .mockResolvedValueOnce(4); // overtimeRecords

      db.cpAttendance.aggregate.mockResolvedValue({
        _avg: { hoursWorked: 8.5 },
        _sum: { hoursWorked: 85.0 },
      });

      db.cpAttendance.groupBy.mockResolvedValue([
        { staffId: 'staff-1' },
        { staffId: 'staff-2' },
      ]);

      const result = await service.getAttendanceSummary(mockCtx, mockQuery);

      expect(result).toEqual({
        totalRecords: 10,
        uniqueStaffCount: 2,
        lateCount: 2,
        overtimeCount: 4,
        latePercentage: 20,
        overtimePercentage: 40,
        avgHoursWorked: 8.5,
        totalHoursWorked: 85,
        dateRange: { from: '2026-07-01', to: '2026-07-21' },
      });
    });
  });

  describe('getClientMetrics', () => {
    it('returns correct aggregated client engagement metrics for seeded data', async () => {
      const mockCtx = { workspaceId: 'ws-1' } as any;
      const mockQuery = {};

      db.cpClient.count
        .mockResolvedValueOnce(5) // totalClients
        .mockResolvedValueOnce(3) // activeClients (based on invoices)
        .mockResolvedValueOnce(3); // clientsWithInvoices

      db.cpAppointment.groupBy.mockResolvedValue([
        { status: 'CONFIRMED', _count: { id: 2 } },
        { status: 'PENDING', _count: { id: 1 } },
      ]);

      db.cpLead.count
        .mockResolvedValueOnce(10) // totalLeads
        .mockResolvedValueOnce(4);  // convertedLeads

      const result = await service.getClientMetrics(mockCtx, mockQuery);

      expect(result).toEqual({
        totalClients: 5,
        activeClients: 3,
        inactiveClients: 2,
        clientsWithInvoices: 3,
        engagementRate: 60,
        appointments: {
          byStatus: { CONFIRMED: 2, PENDING: 1 },
          total: 3,
        },
        leads: {
          created: 10,
          converted: 4,
          conversionRate: 40,
        },
        dateRange: { from: null, to: null },
      });
    });
  });

  describe('getInvoiceStats', () => {
    it('returns correct aggregated invoice and billing metrics for seeded data', async () => {
      const mockCtx = { workspaceId: 'ws-1' } as any;
      const mockQuery = {};

      db.cpInvoice.groupBy.mockResolvedValue([
        { status: 'PAID', _count: { id: 2 }, _sum: { totalAmount: 4000 } },
        { status: 'SENT', _count: { id: 1 }, _sum: { totalAmount: 1000 } },
      ]);

      db.cpInvoice.aggregate
        .mockResolvedValueOnce({ _sum: { totalAmount: 5000 }, _count: { id: 3 } }) // total billing
        .mockResolvedValueOnce({ _sum: { totalAmount: 4000 } })                  // paid
        .mockResolvedValueOnce({ _sum: { totalAmount: 0 } })                     // overdue
        .mockResolvedValueOnce({ _sum: { totalAmount: 1000 } });                  // outstanding (SENT/OVERDUE)

      const result = await service.getInvoiceStats(mockCtx, mockQuery);

      expect(result).toEqual({
        totalInvoices: 3,
        totalBilled: 5000,
        totalPaid: 4000,
        totalOverdue: 0,
        totalOutstanding: 1000,
        byStatus: {
          PAID: { count: 2, totalAmount: 4000 },
          SENT: { count: 1, totalAmount: 1000 },
        },
        collectionRate: 80,
        dateRange: { from: null, to: null },
      });
    });
  });
});
