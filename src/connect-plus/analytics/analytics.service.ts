import {
  Injectable,
  ForbiddenException,
  Inject,
  Optional,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Prisma, CpInvoiceStatus, CpRole } from '../../generated/prisma/client';
import { DatabaseService } from '../../database/database.service';
import { CpRequestContext } from '../types/cp-request.types';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Injectable()
export class CpAnalyticsService {
  constructor(
    private readonly db: DatabaseService,
    @Optional() @Inject(CACHE_MANAGER) private readonly cache: Cache | null,
  ) {}

  // ---------------------------------------------------------------------------
  // Attendance Summary — WORKSPACE_ADMIN
  // ---------------------------------------------------------------------------
  async getAttendanceSummary(ctx: CpRequestContext, query: AnalyticsQueryDto) {
    if (!ctx.workspaceId) throw new ForbiddenException('Workspace required');

    const cacheKey = `analytics:attendance:${ctx.workspaceId}:${query.from ?? ''}:${query.to ?? ''}`;
    const cached = await this.cache?.get(cacheKey);
    if (cached) return cached;

    const dateFilter = this.buildDateFilter(query);

    const [
      totalRecords,
      lateRecords,
      overtimeRecords,
      hoursAgg,
      uniqueStaff,
    ] = await Promise.all([
      this.db.cpAttendance.count({
        where: { workspaceId: ctx.workspaceId, ...dateFilter },
      }),
      this.db.cpAttendance.count({
        where: { workspaceId: ctx.workspaceId, isLate: true, ...dateFilter },
      }),
      this.db.cpAttendance.count({
        where: {
          workspaceId: ctx.workspaceId,
          isOvertime: true,
          ...dateFilter,
        },
      }),
      this.db.cpAttendance.aggregate({
        where: {
          workspaceId: ctx.workspaceId,
          hoursWorked: { not: null },
          ...dateFilter,
        },
        _avg: { hoursWorked: true },
        _sum: { hoursWorked: true },
      }),
      this.db.cpAttendance
        .groupBy({
          by: ['staffId'],
          where: { workspaceId: ctx.workspaceId, ...dateFilter },
        })
        .then((r) => r.length),
    ]);

    const result = {
      totalRecords,
      uniqueStaffCount: uniqueStaff,
      lateCount: lateRecords,
      overtimeCount: overtimeRecords,
      latePercentage: totalRecords > 0 ? (lateRecords / totalRecords) * 100 : 0,
      overtimePercentage:
        totalRecords > 0 ? (overtimeRecords / totalRecords) * 100 : 0,
      avgHoursWorked: hoursAgg._avg.hoursWorked
        ? Number(hoursAgg._avg.hoursWorked)
        : 0,
      totalHoursWorked: hoursAgg._sum.hoursWorked
        ? Number(hoursAgg._sum.hoursWorked)
        : 0,
      dateRange: { from: query.from ?? null, to: query.to ?? null },
    };

    await this.cache?.set(cacheKey, result, 300_000); // 5 min TTL
    return result;
  }

  // ---------------------------------------------------------------------------
  // Client Engagement Metrics — WORKSPACE_ADMIN
  // ---------------------------------------------------------------------------
  async getClientMetrics(ctx: CpRequestContext, query: AnalyticsQueryDto) {
    if (!ctx.workspaceId) throw new ForbiddenException('Workspace required');

    const cacheKey = `analytics:clients:${ctx.workspaceId}:${query.from ?? ''}:${query.to ?? ''}`;
    const cached = await this.cache?.get(cacheKey);
    if (cached) return cached;

    const dateFilter = this.buildDateFilter(query, 'createdAt');

    const [
      totalClients,
      activeClients,
      clientsWithInvoices,
      appointmentStats,
    ] = await Promise.all([
      this.db.cpClient.count({
        where: { workspaceId: ctx.workspaceId, deletedAt: null, ...dateFilter },
      }),
      this.db.cpClient.count({
        where: {
          workspaceId: ctx.workspaceId,
          deletedAt: null,
          invoices: { some: { deletedAt: null } },
        },
      }),
      this.db.cpClient.count({
        where: {
          workspaceId: ctx.workspaceId,
          deletedAt: null,
          invoices: { some: { deletedAt: null } },
        },
      }),
      this.db.cpAppointment.groupBy({
        by: ['status'],
        where: { workspaceId: ctx.workspaceId, ...dateFilter },
        _count: { id: true },
      }),
    ]);

    const apptByStatus = Object.fromEntries(
      appointmentStats.map((s) => [s.status, s._count.id]),
    );

    const result = {
      totalClients,
      activeClients,
      inactiveClients: totalClients - activeClients,
      clientsWithInvoices,
      engagementRate:
        totalClients > 0 ? (activeClients / totalClients) * 100 : 0,
      appointments: {
        byStatus: apptByStatus,
        total: appointmentStats.reduce((sum, s) => sum + s._count.id, 0),
      },
      dateRange: { from: query.from ?? null, to: query.to ?? null },
    };

    await this.cache?.set(cacheKey, result, 300_000);
    return result;
  }

  // ---------------------------------------------------------------------------
  // Revenue / Invoice Stats — WORKSPACE_ADMIN
  // ---------------------------------------------------------------------------
  async getInvoiceStats(ctx: CpRequestContext, query: AnalyticsQueryDto) {
    if (!ctx.workspaceId) throw new ForbiddenException('Workspace required');

    const cacheKey = `analytics:invoices:${ctx.workspaceId}:${query.from ?? ''}:${query.to ?? ''}`;
    const cached = await this.cache?.get(cacheKey);
    if (cached) return cached;

    const dateFilter = this.buildDateFilter(query, 'createdAt');
    const baseWhere = { workspaceId: ctx.workspaceId, deletedAt: null };

    const [byStatus, totalAgg, paidAgg, overdueAgg, outstandingAgg] =
      await Promise.all([
        this.db.cpInvoice.groupBy({
          by: ['status'],
          where: { ...baseWhere, ...dateFilter },
          _count: { id: true },
          _sum: { totalAmount: true },
        }),
        this.db.cpInvoice.aggregate({
          where: { ...baseWhere, ...dateFilter },
          _sum: { totalAmount: true },
          _count: { id: true },
        }),
        this.db.cpInvoice.aggregate({
          where: { ...baseWhere, status: CpInvoiceStatus.PAID, ...dateFilter },
          _sum: { totalAmount: true },
        }),
        this.db.cpInvoice.aggregate({
          where: {
            ...baseWhere,
            status: CpInvoiceStatus.OVERDUE,
            ...dateFilter,
          },
          _sum: { totalAmount: true },
        }),
        this.db.cpInvoice.aggregate({
          where: {
            ...baseWhere,
            status: { in: [CpInvoiceStatus.SENT, CpInvoiceStatus.OVERDUE] },
            ...dateFilter,
          },
          _sum: { totalAmount: true },
        }),
      ]);

    const statusSummary = Object.fromEntries(
      byStatus.map((s) => [
        s.status,
        {
          count: s._count.id,
          totalAmount: s._sum.totalAmount
            ? Number(s._sum.totalAmount)
            : 0,
        },
      ]),
    );

    const result = {
      totalInvoices: totalAgg._count.id,
      totalBilled: totalAgg._sum.totalAmount
        ? Number(totalAgg._sum.totalAmount)
        : 0,
      totalPaid: paidAgg._sum.totalAmount
        ? Number(paidAgg._sum.totalAmount)
        : 0,
      totalOverdue: overdueAgg._sum.totalAmount
        ? Number(overdueAgg._sum.totalAmount)
        : 0,
      totalOutstanding: outstandingAgg._sum.totalAmount
        ? Number(outstandingAgg._sum.totalAmount)
        : 0,
      byStatus: statusSummary,
      collectionRate:
        totalAgg._sum.totalAmount &&
        Number(totalAgg._sum.totalAmount) > 0
          ? (Number(paidAgg._sum.totalAmount ?? 0) /
              Number(totalAgg._sum.totalAmount)) *
            100
          : 0,
      dateRange: { from: query.from ?? null, to: query.to ?? null },
    };

    await this.cache?.set(cacheKey, result, 300_000);
    return result;
  }

  // ---------------------------------------------------------------------------
  // Individual Staff Metrics — WORKSPACE_ADMIN or STAFF (self)
  // ---------------------------------------------------------------------------
  async getStaffMetrics(
    ctx: CpRequestContext,
    staffId: string,
    query: AnalyticsQueryDto,
  ) {
    if (!ctx.workspaceId) throw new ForbiddenException('Workspace required');

    const staffProfile = await this.db.cpStaffProfile.findFirst({
      where: { id: staffId, workspaceId: ctx.workspaceId, deletedAt: null },
      select: { memberId: true, authUserId: true, name: true, jobTitle: true, department: true },
    });
    if (!staffProfile) throw new ForbiddenException('Staff not found');

    // STAFF can only see own metrics
    if (
      ctx.role === CpRole.STAFF &&
      staffProfile.memberId !== ctx.memberId
    ) {
      throw new ForbiddenException('You can only view your own metrics');
    }

    const cacheKey = `analytics:staff:${ctx.workspaceId}:${staffId}:${query.from ?? ''}:${query.to ?? ''}`;
    const cached = await this.cache?.get(cacheKey);
    if (cached) return cached;

    const dateFilter = this.buildDateFilter(query);

    const [
      attendanceAgg,
      lateCount,
      overtimeCount,
      clientCount,
      appointmentStats,
      invoiceAgg,
    ] = await Promise.all([
      this.db.cpAttendance.aggregate({
        where: { staffId, workspaceId: ctx.workspaceId, ...dateFilter },
        _count: { id: true },
        _avg: { hoursWorked: true },
        _sum: { hoursWorked: true },
      }),
      this.db.cpAttendance.count({
        where: { staffId, workspaceId: ctx.workspaceId, isLate: true, ...dateFilter },
      }),
      this.db.cpAttendance.count({
        where: { staffId, workspaceId: ctx.workspaceId, isOvertime: true, ...dateFilter },
      }),
      this.db.cpClient.count({
        where: {
          assignedStaffId: staffId,
          workspaceId: ctx.workspaceId,
          deletedAt: null,
        },
      }),
      this.db.cpAppointment.groupBy({
        by: ['status'],
        where: { staffId, workspaceId: ctx.workspaceId, ...dateFilter },
        _count: { id: true },
      }),
      this.db.cpInvoice.aggregate({
        where: {
          createdByStaffId: staffId,
          workspaceId: ctx.workspaceId,
          deletedAt: null,
          ...(dateFilter.date
            ? { createdAt: dateFilter.date }
            : {}),
        },
        _count: { id: true },
        _sum: { totalAmount: true },
      }),
    ]);

    const apptByStatus = Object.fromEntries(
      appointmentStats.map((s) => [s.status, s._count.id]),
    );

    const result = {
      staffId,
      name: staffProfile.name,
      jobTitle: staffProfile.jobTitle ?? null,
      department: staffProfile.department ?? null,
      attendance: {
        totalDays: attendanceAgg._count.id,
        lateCount,
        overtimeCount,
        avgHoursWorked: attendanceAgg._avg.hoursWorked
          ? Number(attendanceAgg._avg.hoursWorked)
          : 0,
        totalHoursWorked: attendanceAgg._sum.hoursWorked
          ? Number(attendanceAgg._sum.hoursWorked)
          : 0,
        latePercentage:
          attendanceAgg._count.id > 0
            ? (lateCount / attendanceAgg._count.id) * 100
            : 0,
      },
      clients: { assignedCount: clientCount },
      appointments: {
        byStatus: apptByStatus,
        total: appointmentStats.reduce((sum, s) => sum + s._count.id, 0),
      },
      invoices: {
        createdCount: invoiceAgg._count.id,
        totalBilled: invoiceAgg._sum.totalAmount
          ? Number(invoiceAgg._sum.totalAmount)
          : 0,
      },
      dateRange: { from: query.from ?? null, to: query.to ?? null },
    };

    await this.cache?.set(cacheKey, result, 300_000);
    return result;
  }

  // ---------------------------------------------------------------------------
  // Org-level Aggregated Analytics — CREATOR (no client PII)
  // ---------------------------------------------------------------------------
  async getOrgAnalytics(ctx: CpRequestContext, query: AnalyticsQueryDto) {
    const cacheKey = `analytics:org:${ctx.organizationId}:${query.from ?? ''}:${query.to ?? ''}`;
    const cached = await this.cache?.get(cacheKey);
    if (cached) return cached;

    const dateFilter = this.buildDateFilter(query, 'createdAt');

    const workspaces = await this.db.cpWorkspace.findMany({
      where: { organizationId: ctx.organizationId, deletedAt: null },
      select: { id: true, name: true },
    });
    const wsIds = workspaces.map((w) => w.id);

    if (wsIds.length === 0) {
      return {
        organizationId: ctx.organizationId,
        workspaceCount: 0,
        totals: {
          staff: 0,
          clients: 0,
          invoices: 0,
          totalBilled: 0,
          totalPaid: 0,
        },
        perWorkspace: [],
        dateRange: { from: query.from ?? null, to: query.to ?? null },
      };
    }

    const [staffAgg, clientAgg, invoiceAgg] = await Promise.all([
      this.db.cpStaffProfile.groupBy({
        by: ['workspaceId'],
        where: { workspaceId: { in: wsIds }, deletedAt: null },
        _count: { id: true },
      }),
      this.db.cpClient.groupBy({
        by: ['workspaceId'],
        where: { workspaceId: { in: wsIds }, deletedAt: null },
        _count: { id: true },
      }),
      this.db.cpInvoice.groupBy({
        by: ['workspaceId', 'status'],
        where: { workspaceId: { in: wsIds }, deletedAt: null, ...dateFilter },
        _count: { id: true },
        _sum: { totalAmount: true },
      }),
    ]);

    const staffByWs = Object.fromEntries(
      staffAgg.map((s) => [s.workspaceId, s._count.id]),
    );
    const clientByWs = Object.fromEntries(
      clientAgg.map((c) => [c.workspaceId, c._count.id]),
    );

    // Aggregate invoice totals per workspace without PII
    const invoiceByWs: Record<
      string,
      { count: number; totalBilled: number; totalPaid: number }
    > = {};
    for (const row of invoiceAgg) {
      if (!invoiceByWs[row.workspaceId]) {
        invoiceByWs[row.workspaceId] = { count: 0, totalBilled: 0, totalPaid: 0 };
      }
      invoiceByWs[row.workspaceId].count += row._count.id;
      invoiceByWs[row.workspaceId].totalBilled += row._sum.totalAmount
        ? Number(row._sum.totalAmount)
        : 0;
      if (row.status === CpInvoiceStatus.PAID) {
        invoiceByWs[row.workspaceId].totalPaid += row._sum.totalAmount
          ? Number(row._sum.totalAmount)
          : 0;
      }
    }

    const perWorkspace = workspaces.map((ws) => ({
      workspaceId: ws.id,
      name: ws.name,
      staffCount: staffByWs[ws.id] ?? 0,
      clientCount: clientByWs[ws.id] ?? 0,
      invoices: invoiceByWs[ws.id] ?? {
        count: 0,
        totalBilled: 0,
        totalPaid: 0,
      },
    }));

    const totals = perWorkspace.reduce(
      (acc, ws) => ({
        staff: acc.staff + ws.staffCount,
        clients: acc.clients + ws.clientCount,
        invoices: acc.invoices + ws.invoices.count,
        totalBilled: acc.totalBilled + ws.invoices.totalBilled,
        totalPaid: acc.totalPaid + ws.invoices.totalPaid,
      }),
      { staff: 0, clients: 0, invoices: 0, totalBilled: 0, totalPaid: 0 },
    );

    const result = {
      organizationId: ctx.organizationId,
      workspaceCount: workspaces.length,
      totals,
      perWorkspace,
      dateRange: { from: query.from ?? null, to: query.to ?? null },
    };

    await this.cache?.set(cacheKey, result, 300_000);
    return result;
  }

  // ---------------------------------------------------------------------------
  // Helper: build date filter for Prisma where clause
  // ---------------------------------------------------------------------------
  private buildDateFilter(
    query: AnalyticsQueryDto,
    field: 'date' | 'createdAt' = 'date',
  ): Record<string, Prisma.DateTimeFilter> {
    if (!query.from && !query.to) return {};
    const filter: Prisma.DateTimeFilter = {};
    if (query.from) filter.gte = new Date(query.from);
    if (query.to) filter.lte = new Date(query.to + 'T23:59:59.999Z');
    return { [field]: filter };
  }
}

