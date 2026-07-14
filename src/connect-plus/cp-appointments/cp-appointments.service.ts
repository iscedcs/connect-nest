import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CpRequestContext } from '../types/cp-request.types';
import { CpAuditLogService } from '../audit-logs/cp-audit-log.service';
import { CpNotificationsService } from '../notifications/notifications.service';
import {
  CpRole,
  CpAppointmentType,
  CpNotificationType,
} from '../../generated/prisma/client';
import { CreateAppointmentDto } from './dto/create-cp-appointment.dto';
import { UpdateCpAppointmentDto } from './dto/update-cp-appointment.dto';
import { UpdateCpAppointmentStatusDto } from './dto/update-cp-appointment-status.dto';
import { PaginateQueryDto } from '../common/dto/paginate-query.dto';
import { paginateResult } from '../utils/paginate';
import { Request } from 'express';

@Injectable()
export class CpAppointmentsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auditLog: CpAuditLogService,
    private readonly notifications: CpNotificationsService,
  ) {}

  async getMe(ctx: CpRequestContext) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId)
      throw new ForbiddenException('Workspace context required');

    const client = await this.db.cpClient.findFirst({
      where: {
        workspaceId,
        member: { authUserId: ctx.authUserId },
        deletedAt: null,
      },
    });
    if (!client) throw new NotFoundException('Client profile not found');

    return this.db.cpAppointment.findMany({
      where: { workspaceId, clientId: client.id, deletedAt: null },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async list(ctx: CpRequestContext, query: PaginateQueryDto) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId)
      throw new ForbiddenException('Workspace context required');

    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [data, total] = await this.db.$transaction([
      this.db.cpAppointment.findMany({
        where: { workspaceId, deletedAt: null },
        include: { client: true, staff: true },
        skip,
        take: limit,
        orderBy: { scheduledAt: 'desc' },
      }),
      this.db.cpAppointment.count({ where: { workspaceId, deletedAt: null } }),
    ]);

    return paginateResult(data, total, page, limit);
  }

  async listAssigned(ctx: CpRequestContext, query: PaginateQueryDto) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId)
      throw new ForbiddenException('Workspace context required');

    const staffProfile = await this.db.cpStaffProfile.findFirst({
      where: { workspaceId, memberId: ctx.memberId, deletedAt: null },
    });
    if (!staffProfile) throw new NotFoundException('Staff profile not found');

    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [data, total] = await this.db.$transaction([
      this.db.cpAppointment.findMany({
        where: { workspaceId, staffId: staffProfile.id, deletedAt: null },
        include: { client: true },
        skip,
        take: limit,
        orderBy: { scheduledAt: 'desc' },
      }),
      this.db.cpAppointment.count({
        where: { workspaceId, staffId: staffProfile.id, deletedAt: null },
      }),
    ]);

    return paginateResult(data, total, page, limit);
  }

  async findById(ctx: CpRequestContext, appointmentId: string) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId)
      throw new ForbiddenException('Workspace context required');

    const appt = await this.db.cpAppointment.findFirst({
      where: { id: appointmentId, workspaceId, deletedAt: null },
      include: { client: true, staff: true, lead: true },
    });
    if (!appt) throw new NotFoundException('Appointment not found');
    return appt;
  }

  async create(ctx: CpRequestContext, dto: CreateAppointmentDto, req: Request) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId)
      throw new ForbiddenException('Workspace context required');

    if (dto.staffId && dto.scheduledAt) {
      const scheduledAt = new Date(dto.scheduledAt);
      const endsAt = dto.endsAt
        ? new Date(dto.endsAt)
        : new Date(scheduledAt.getTime() + 60 * 60 * 1000);
      const conflicting = await this.db.cpAppointment.findFirst({
        where: {
          workspaceId,
          staffId: dto.staffId,
          deletedAt: null,
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
          AND: [
            { scheduledAt: { lt: endsAt } },
            {
              OR: [
                { endsAt: { gt: scheduledAt } },
                {
                  endsAt: null,
                  scheduledAt: {
                    gte: new Date(scheduledAt.getTime() - 60 * 60 * 1000),
                  },
                },
              ],
            },
          ],
        },
      });
      if (conflicting) {
        throw new ConflictException(
          'Staff member has a conflicting appointment at this time',
        );
      }
    }

    const appt = await this.db.cpAppointment.create({
      data: {
        workspaceId,
        type: CpAppointmentType.CLIENT,
        title: dto.title,
        reason: dto.reason,
        scheduledAt: new Date(dto.scheduledAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        clientId: dto.clientId ?? undefined,
        staffId: dto.staffId ?? undefined,
        notes: dto.notes ?? undefined,
      },
    });

    this.auditLog.write({
      ctx,
      req,
      workspaceId,
      organizationId: ctx.organizationId,
      eventType: 'APPOINTMENT_CREATED',
      targetEntity: 'CpAppointment',
      targetEntityId: appt.id,
      action: 'CREATE',
      after: appt as Record<string, unknown>,
    });

    if (dto.clientId) {
      const client = await this.db.cpClient.findUnique({
        where: { id: dto.clientId },
      });
      if (client?.authUserId) {
        void this.notifications.send({
          recipientAuthId: client.authUserId,
          type: CpNotificationType.APPOINTMENT_BOOKED,
          title: 'Appointment Scheduled',
          message: `Appointment "${dto.title}" scheduled for ${new Date(dto.scheduledAt).toLocaleString()}`,
          workspaceId,
          organizationId: ctx.organizationId,
          metadata: { appointmentId: appt.id },
        });
      }
    }

    return appt;
  }

  async update(
    ctx: CpRequestContext,
    appointmentId: string,
    dto: UpdateCpAppointmentDto,
    req: Request,
  ) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId)
      throw new ForbiddenException('Workspace context required');

    const appt = await this.db.cpAppointment.findFirst({
      where: { id: appointmentId, workspaceId, deletedAt: null },
    });
    if (!appt) throw new NotFoundException('Appointment not found');

    // STAFF can only update their own appointments
    if (ctx.role === CpRole.STAFF) {
      const staffProfile = await this.db.cpStaffProfile.findFirst({
        where: { workspaceId, memberId: ctx.memberId },
      });
      if (!staffProfile || appt.staffId !== staffProfile.id) {
        throw new ForbiddenException('Access denied');
      }
    }

    const updateData: Record<string, unknown> = {};
    let newScheduledAt: Date | undefined = undefined;
    let newEndsAt: Date | undefined = undefined;
    let newStaffId: string | undefined = undefined;

    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.reason !== undefined) updateData.reason = dto.reason;
    if (dto.notes !== undefined) updateData.notes = dto.notes;
    if (dto.scheduledAt !== undefined) {
      newScheduledAt = new Date(dto.scheduledAt);
      updateData.scheduledAt = newScheduledAt;
    }
    if (dto.endsAt !== undefined) {
      newEndsAt = new Date(dto.endsAt);
      updateData.endsAt = newEndsAt;
    }
    if (dto.staffId !== undefined) {
      newStaffId = dto.staffId;
      updateData.staffId = newStaffId;
    }
    if (dto.clientId !== undefined) updateData.clientId = dto.clientId;

    const checkStaffId = newStaffId !== undefined ? newStaffId : appt.staffId;
    const checkScheduledAt =
      newScheduledAt !== undefined ? newScheduledAt : appt.scheduledAt;
    const checkEndsAt = newEndsAt !== undefined ? newEndsAt : appt.endsAt;

    if (
      checkStaffId &&
      (newScheduledAt || newEndsAt || newStaffId !== appt.staffId)
    ) {
      const endsAt = checkEndsAt
        ? checkEndsAt
        : new Date(checkScheduledAt.getTime() + 60 * 60 * 1000);
      const conflicting = await this.db.cpAppointment.findFirst({
        where: {
          workspaceId,
          id: { not: appointmentId },
          staffId: checkStaffId,
          deletedAt: null,
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
          AND: [
            { scheduledAt: { lt: endsAt } },
            {
              OR: [
                { endsAt: { gt: checkScheduledAt } },
                {
                  endsAt: null,
                  scheduledAt: {
                    gte: new Date(checkScheduledAt.getTime() - 60 * 60 * 1000),
                  },
                },
              ],
            },
          ],
        },
      });
      if (conflicting) {
        throw new ConflictException(
          'Staff member has a conflicting appointment at this time',
        );
      }
    }

    const updated = await this.db.cpAppointment.update({
      where: { id: appointmentId },
      data: updateData,
    });

    this.auditLog.write({
      ctx,
      req,
      workspaceId,
      organizationId: ctx.organizationId,
      eventType: 'APPOINTMENT_UPDATED',
      targetEntity: 'CpAppointment',
      targetEntityId: appointmentId,
      action: 'UPDATE',
      before: appt as Record<string, unknown>,
      after: updated as Record<string, unknown>,
    });

    return updated;
  }

  async updateStatus(
    ctx: CpRequestContext,
    appointmentId: string,
    dto: UpdateCpAppointmentStatusDto,
    req: Request,
  ) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId)
      throw new ForbiddenException('Workspace context required');

    const appt = await this.db.cpAppointment.findFirst({
      where: { id: appointmentId, workspaceId, deletedAt: null },
    });
    if (!appt) throw new NotFoundException('Appointment not found');

    const updated = await this.db.cpAppointment.update({
      where: { id: appointmentId },
      data: { status: dto.status },
    });

    this.auditLog.write({
      ctx,
      req,
      workspaceId,
      organizationId: ctx.organizationId,
      eventType: 'APPOINTMENT_STATUS_CHANGED',
      targetEntity: 'CpAppointment',
      targetEntityId: appointmentId,
      action: 'UPDATE',
      before: { status: appt.status } as Record<string, unknown>,
      after: { status: dto.status } as Record<string, unknown>,
    });

    return updated;
  }

  async cancel(ctx: CpRequestContext, appointmentId: string, req: Request) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId)
      throw new ForbiddenException('Workspace context required');

    const appt = await this.db.cpAppointment.findFirst({
      where: { id: appointmentId, workspaceId, deletedAt: null },
    });
    if (!appt) throw new NotFoundException('Appointment not found');

    await this.db.cpAppointment.update({
      where: { id: appointmentId },
      data: { deletedAt: new Date(), status: 'CANCELLED' },
    });

    this.auditLog.write({
      ctx,
      req,
      workspaceId,
      organizationId: ctx.organizationId,
      eventType: 'APPOINTMENT_CANCELLED',
      targetEntity: 'CpAppointment',
      targetEntityId: appointmentId,
      action: 'DELETE',
      before: appt as Record<string, unknown>,
    });

    return { message: 'Appointment cancelled' };
  }
}
