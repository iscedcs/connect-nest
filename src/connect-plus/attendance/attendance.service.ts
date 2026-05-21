import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { DatabaseService } from '../../database/database.service';
import { CpAuditLogService } from '../audit-logs/cp-audit-log.service';
import { CpNotificationsService } from '../notifications/notifications.service';
import { CpRequestContext } from '../types/cp-request.types';
import { CpNotificationType, CpRole, CpMemberStatus } from '../../generated/prisma/client';
import { paginateResult } from '../utils/paginate';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { ListAttendanceQueryDto } from './dto/list-attendance-query.dto';
import { OverrideAttendanceDto } from './dto/override-attendance.dto';
import { Request } from 'express';

interface BusinessHourEntry {
  day: number;
  open: string;
  close: string;
  isOpen: boolean;
}

@Injectable()
export class CpAttendanceService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auditLog: CpAuditLogService,
    private readonly notifications: CpNotificationsService,
  ) {}

  private todayUtcMidnight(): Date {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  private async requireStaffProfile(ctx: CpRequestContext) {
    if (!ctx.memberId) throw new ForbiddenException('No member context');
    const staff = await this.db.cpStaffProfile.findUnique({
      where: { memberId: ctx.memberId },
    });
    if (!staff || staff.deletedAt) throw new NotFoundException('Staff profile not found');
    return staff;
  }

  private async getBusinessHoursEntry(workspaceId: string, dayIndex: number) {
    const profile = await this.db.cpCompanyProfile.findUnique({
      where: { workspaceId },
      select: { businessHours: true },
    });
    if (!profile?.businessHours) return null;
    const hours = profile.businessHours as unknown as BusinessHourEntry[];
    if (!Array.isArray(hours)) return null;
    return hours.find((h) => h.day === dayIndex) ?? null;
  }

  private parseTimeToUtcMs(timeStr: string, anchorDate: Date): number {
    const [hh, mm] = timeStr.split(':').map(Number);
    const dt = new Date(anchorDate);
    dt.setUTCHours(hh, mm, 0, 0);
    return dt.getTime();
  }

  async checkIn(ctx: CpRequestContext, dto: CheckInDto, req: Request) {
    const workspaceId = ctx.workspaceId!;
    const staff = await this.requireStaffProfile(ctx);
    const date = this.todayUtcMidnight();

    const existing = await this.db.cpAttendance.findUnique({
      where: { staffId_date: { staffId: staff.id, date } },
    });
    if (existing) throw new ConflictException('Already checked in for today');

    const now = new Date();
    const entry = await this.getBusinessHoursEntry(workspaceId, date.getUTCDay());
    let isLate = false;
    if (entry?.isOpen && entry.open) {
      const openMs = this.parseTimeToUtcMs(entry.open, date);
      isLate = now.getTime() > openMs + 5 * 60 * 1000;
    }

    const record = await this.db.cpAttendance.create({
      data: {
        workspaceId,
        staffId: staff.id,
        date,
        checkIn: now,
        isLate,
        locationData: (dto.locationData ?? null) as Prisma.InputJsonValue | null,
      },
    });

    this.auditLog.write({
      ctx, req, workspaceId, organizationId: ctx.organizationId,
      eventType: 'ATTENDANCE_CHECK_IN',
      targetEntity: 'CpAttendance', targetEntityId: record.id,
      action: 'CREATE', after: record as unknown as Record<string, unknown>,
    });

    this.notifications.send({
      recipientAuthId: ctx.authUserId,
      type: CpNotificationType.ATTENDANCE_LATE,
      title: isLate ? 'Checked in (late)' : 'Checked in',
      message: isLate
        ? `You checked in at ${now.toISOString()} — marked as late.`
        : `You checked in at ${now.toISOString()}.`,
      workspaceId, organizationId: ctx.organizationId,
    });

    if (isLate) {
      const admins = await this.db.cpWorkspaceMember.findMany({
        where: { workspaceId, role: CpRole.WORKSPACE_ADMIN, status: CpMemberStatus.ACTIVE },
      });
      for (const admin of admins) {
        this.notifications.send({
          recipientAuthId: admin.authUserId,
          type: CpNotificationType.ATTENDANCE_LATE,
          title: 'Late check-in',
          message: `${staff.name} checked in late at ${now.toISOString()}.`,
          workspaceId, organizationId: ctx.organizationId,
        });
      }
    }

    return record;
  }

  async checkOut(ctx: CpRequestContext, dto: CheckOutDto, req: Request) {
    const workspaceId = ctx.workspaceId!;
    const staff = await this.requireStaffProfile(ctx);
    const date = this.todayUtcMidnight();

    const record = await this.db.cpAttendance.findUnique({
      where: { staffId_date: { staffId: staff.id, date } },
    });
    if (!record) throw new NotFoundException('No check-in record found for today');
    if (record.checkOut) throw new ConflictException('Already checked out');

    const now = new Date();
    const ms = now.getTime() - record.checkIn.getTime();
    const hoursWorked = parseFloat((ms / 3_600_000).toFixed(2));

    const entry = await this.getBusinessHoursEntry(workspaceId, date.getUTCDay());
    let isOvertime = hoursWorked > 9;
    if (entry?.isOpen && entry.close) {
      isOvertime = now.getTime() > this.parseTimeToUtcMs(entry.close, date);
    }

    const updated = await this.db.cpAttendance.update({
      where: { id: record.id },
      data: {
        checkOut: now,
        hoursWorked,
        isOvertime,
        locationData: (dto.locationData ?? record.locationData) as Prisma.InputJsonValue | null,
      },
    });

    this.auditLog.write({
      ctx, req, workspaceId, organizationId: ctx.organizationId,
      eventType: 'ATTENDANCE_CHECK_OUT',
      targetEntity: 'CpAttendance', targetEntityId: record.id,
      action: 'UPDATE',
      before: record as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
    });

    this.notifications.send({
      recipientAuthId: ctx.authUserId,
      type: CpNotificationType.ATTENDANCE_OVERRIDE,
      title: 'Checked out',
      message: `You checked out at ${now.toISOString()}. Hours worked: ${hoursWorked}.`,
      workspaceId, organizationId: ctx.organizationId,
    });

    return updated;
  }

  async getMyAttendance(ctx: CpRequestContext, query: ListAttendanceQueryDto) {
    const staff = await this.requireStaffProfile(ctx);
    return this.queryAttendance(staff.id, ctx.workspaceId!, query);
  }

  async listAll(ctx: CpRequestContext, query: ListAttendanceQueryDto) {
    return this.queryAttendance(query.staffId, ctx.workspaceId!, query);
  }

  async getStaffAttendance(ctx: CpRequestContext, staffId: string, query: ListAttendanceQueryDto) {
    const staffProfile = await this.db.cpStaffProfile.findFirst({
      where: { id: staffId, workspaceId: ctx.workspaceId! },
    });
    if (!staffProfile) throw new NotFoundException('Staff not found in workspace');
    return this.queryAttendance(staffId, ctx.workspaceId!, query);
  }

  async override(
    ctx: CpRequestContext,
    recordId: string,
    dto: OverrideAttendanceDto,
    req: Request,
  ) {
    const record = await this.db.cpAttendance.findFirst({
      where: { id: recordId, workspaceId: ctx.workspaceId! },
    });
    if (!record) throw new NotFoundException('Attendance record not found');

    const checkInTime = dto.checkIn ? new Date(dto.checkIn) : record.checkIn;
    const checkOutTime = dto.checkOut ? new Date(dto.checkOut) : record.checkOut;

    let isOvertime = record.isOvertime;
    let hoursWorkedDecimal = record.hoursWorked;
    if (checkOutTime) {
      const ms = checkOutTime.getTime() - checkInTime.getTime();
      const hw = parseFloat((ms / 3_600_000).toFixed(2));
      hoursWorkedDecimal = hw as unknown as typeof record.hoursWorked;
      const entry = await this.getBusinessHoursEntry(ctx.workspaceId!, checkInTime.getUTCDay());
      isOvertime =
        entry?.isOpen && entry.close
          ? checkOutTime.getTime() > this.parseTimeToUtcMs(entry.close, checkInTime)
          : hw > 9;
    }

    const updated = await this.db.cpAttendance.update({
      where: { id: recordId },
      data: {
        checkIn: checkInTime,
        checkOut: checkOutTime,
        hoursWorked: hoursWorkedDecimal ?? undefined,
        isOvertime,
        overriddenBy: ctx.authUserId,
        overriddenAt: new Date(),
        overrideReason: dto.overrideReason,
      },
    });

    this.auditLog.write({
      ctx, req, workspaceId: ctx.workspaceId, organizationId: ctx.organizationId,
      eventType: 'ATTENDANCE_OVERRIDE',
      targetEntity: 'CpAttendance', targetEntityId: recordId,
      action: 'UPDATE',
      before: record as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  private async queryAttendance(
    staffId: string | undefined,
    workspaceId: string,
    query: ListAttendanceQueryDto,
  ) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(query.limit ?? '20', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.CpAttendanceWhereInput = { workspaceId };
    if (staffId) where.staffId = staffId;
    if (query.startDate || query.endDate) {
      where.date = {};
      if (query.startDate) (where.date as Prisma.DateTimeFilter).gte = new Date(query.startDate);
      if (query.endDate) (where.date as Prisma.DateTimeFilter).lte = new Date(query.endDate);
    }
    if (query.isLate !== undefined) where.isLate = query.isLate === 'true';
    if (query.isOvertime !== undefined) where.isOvertime = query.isOvertime === 'true';

    const [data, total] = await Promise.all([
      this.db.cpAttendance.findMany({
        where,
        include: { staff: { select: { id: true, name: true, photo: true, jobTitle: true } } },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      this.db.cpAttendance.count({ where }),
    ]);

    const summaryWhere: Prisma.CpAttendanceWhereInput = { workspaceId };
    if (staffId) summaryWhere.staffId = staffId;
    if (query.startDate || query.endDate) summaryWhere.date = where.date;

    const [lateDays, overtimeDays, allHours] = await Promise.all([
      this.db.cpAttendance.count({ where: { ...summaryWhere, isLate: true } }),
      this.db.cpAttendance.count({ where: { ...summaryWhere, isOvertime: true } }),
      this.db.cpAttendance.findMany({
        where: summaryWhere,
        select: { hoursWorked: true },
      }),
    ]);

    const totalHours = allHours.reduce(
      (sum, r) => sum + (r.hoursWorked ? Number(r.hoursWorked) : 0),
      0,
    );

    return {
      ...paginateResult(data, total, page, limit),
      summary: {
        totalDays: allHours.length,
        totalHours: parseFloat(totalHours.toFixed(2)),
        lateDays,
        overtimeDays,
      },
    };
  }
}

