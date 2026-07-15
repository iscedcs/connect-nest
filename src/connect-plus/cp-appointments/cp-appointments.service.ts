import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CpRequestContext } from '../types/cp-request.types';
import { CpAuditLogService } from '../audit-logs/cp-audit-log.service';
import { CpNotificationsService } from '../notifications/notifications.service';
import {
  CpRole,
  CpAppointmentType,
  CpNotificationType,
  CpAppointmentStatus,
} from '../../generated/prisma/client';
import { CreateAppointmentDto } from './dto/create-cp-appointment.dto';
import { UpdateCpAppointmentDto } from './dto/update-cp-appointment.dto';
import { UpdateCpAppointmentStatusDto } from './dto/update-cp-appointment-status.dto';
import { PaginateQueryDto } from '../common/dto/paginate-query.dto';
import { paginateResult } from '../utils/paginate';
import { Request } from 'express';

const ALLOWED_TRANSITIONS: Record<CpAppointmentStatus, CpAppointmentStatus[]> = {
  [CpAppointmentStatus.PENDING]: [
    CpAppointmentStatus.CONFIRMED,
    CpAppointmentStatus.CANCELLED,
    CpAppointmentStatus.RESCHEDULED,
  ],
  [CpAppointmentStatus.CONFIRMED]: [
    CpAppointmentStatus.COMPLETED,
    CpAppointmentStatus.CANCELLED,
    CpAppointmentStatus.NO_SHOW,
    CpAppointmentStatus.RESCHEDULED,
  ],
  [CpAppointmentStatus.RESCHEDULED]: [
    CpAppointmentStatus.CONFIRMED,
    CpAppointmentStatus.COMPLETED,
    CpAppointmentStatus.CANCELLED,
    CpAppointmentStatus.NO_SHOW,
    CpAppointmentStatus.RESCHEDULED,
  ],
  [CpAppointmentStatus.COMPLETED]: [],
  [CpAppointmentStatus.CANCELLED]: [],
  [CpAppointmentStatus.NO_SHOW]: [],
};

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

  async createForClient(ctx: CpRequestContext, dto: CreateAppointmentDto, req: Request) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId) throw new ForbiddenException('Workspace context required');

    const client = await this.db.cpClient.findFirst({
      where: { workspaceId, member: { authUserId: ctx.authUserId }, deletedAt: null },
    });
    if (!client) throw new NotFoundException('Client profile not found');

    if (!dto.staffId) {
      throw new BadRequestException('A staff member must be selected');
    }

    const staff = await this.db.cpStaffProfile.findFirst({
      where: { id: dto.staffId, workspaceId, deletedAt: null },
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    const scheduledAt = new Date(dto.scheduledAt);
    const durationMs = await this.getDefaultDurationMs(workspaceId);
    const endsAt = dto.endsAt
      ? new Date(dto.endsAt)
      : new Date(scheduledAt.getTime() + durationMs);

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
                  gte: new Date(scheduledAt.getTime() - durationMs),
                },
              },
            ],
          },
        ],
      },
    });
    if (conflicting) {
      throw new ConflictException('Staff member has a conflicting appointment at this time');
    }

    const appt = await this.db.cpAppointment.create({
      data: {
        workspaceId,
        type: CpAppointmentType.CLIENT,
        title: dto.title,
        reason: dto.reason,
        scheduledAt,
        endsAt,
        clientId: client.id,
        staffId: dto.staffId,
        notes: dto.notes ?? undefined,
        status: CpAppointmentStatus.PENDING,
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

    await this.notifyParticipants(
      ctx,
      { id: appt.id, title: appt.title, staffId: appt.staffId, clientId: appt.clientId },
      CpNotificationType.APPOINTMENT_BOOKED,
      'New Appointment Request',
      `${client.name} requested an appointment for ${scheduledAt.toLocaleString()}`
    );

    return appt;
  }

  async updateForClient(ctx: CpRequestContext, appointmentId: string, dto: UpdateCpAppointmentDto, req: Request) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId) throw new ForbiddenException('Workspace context required');

    const client = await this.db.cpClient.findFirst({
      where: { workspaceId, member: { authUserId: ctx.authUserId }, deletedAt: null },
    });
    if (!client) throw new NotFoundException('Client profile not found');

    const appt = await this.db.cpAppointment.findFirst({
      where: { id: appointmentId, workspaceId, clientId: client.id, deletedAt: null },
    });
    if (!appt) throw new NotFoundException('Appointment not found');

    if (appt.status === CpAppointmentStatus.CANCELLED || appt.status === CpAppointmentStatus.COMPLETED || appt.status === CpAppointmentStatus.NO_SHOW) {
      throw new ConflictException('Cannot reschedule a cancelled or completed appointment');
    }

    if (dto.scheduledAt) {
      const scheduledAt = new Date(dto.scheduledAt);
      const durationMs = await this.getDefaultDurationMs(workspaceId);
      const endsAt = dto.endsAt ? new Date(dto.endsAt) : new Date(scheduledAt.getTime() + durationMs);
      const staffId = dto.staffId ?? appt.staffId;

      if (staffId) {
        const conflicting = await this.db.cpAppointment.findFirst({
          where: {
            workspaceId,
            staffId,
            deletedAt: null,
            id: { not: appt.id },
            status: { notIn: ['CANCELLED', 'NO_SHOW'] },
            AND: [
              { scheduledAt: { lt: endsAt } },
              {
                OR: [
                  { endsAt: { gt: scheduledAt } },
                  {
                    endsAt: null,
                    scheduledAt: { gte: new Date(scheduledAt.getTime() - durationMs) },
                  },
                ],
              },
            ],
          },
        });
        if (conflicting) throw new ConflictException('Staff member has a conflicting appointment at this time');
      }
    }

    const updated = await this.db.cpAppointment.update({
      where: { id: appt.id },
      data: {
        title: dto.title,
        reason: dto.reason,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        staffId: dto.staffId ?? undefined,
        status: dto.scheduledAt ? CpAppointmentStatus.RESCHEDULED : undefined,
      },
    });

    this.auditLog.write({
      ctx,
      req,
      workspaceId,
      organizationId: ctx.organizationId,
      eventType: 'APPOINTMENT_UPDATED',
      targetEntity: 'CpAppointment',
      targetEntityId: appt.id,
      action: 'UPDATE',
      before: appt as Record<string, unknown>,
      after: updated as Record<string, unknown>,
    });

    await this.notifyParticipants(
      ctx,
      { id: updated.id, title: updated.title, staffId: updated.staffId, clientId: updated.clientId },
      CpNotificationType.APPOINTMENT_RESCHEDULED,
      'Appointment Rescheduled',
      `${client.name} updated their appointment to ${updated.scheduledAt.toLocaleString()}`
    );

    return updated;
  }

  async cancelForClient(ctx: CpRequestContext, appointmentId: string, req: Request) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId) throw new ForbiddenException('Workspace context required');

    const client = await this.db.cpClient.findFirst({
      where: { workspaceId, member: { authUserId: ctx.authUserId }, deletedAt: null },
    });
    if (!client) throw new NotFoundException('Client profile not found');

    const appt = await this.db.cpAppointment.findFirst({
      where: { id: appointmentId, workspaceId, clientId: client.id, deletedAt: null },
    });
    if (!appt) throw new NotFoundException('Appointment not found');

    if (appt.status === CpAppointmentStatus.COMPLETED || appt.status === CpAppointmentStatus.NO_SHOW || appt.status === CpAppointmentStatus.CANCELLED) {
      throw new ConflictException('Cannot cancel this appointment');
    }

    const updated = await this.db.cpAppointment.update({
      where: { id: appt.id },
      data: { status: CpAppointmentStatus.CANCELLED },
    });

    this.auditLog.write({
      ctx,
      req,
      workspaceId,
      organizationId: ctx.organizationId,
      eventType: 'APPOINTMENT_CANCELLED',
      targetEntity: 'CpAppointment',
      targetEntityId: appt.id,
      action: 'DELETE',
      before: appt as Record<string, unknown>,
    });

    await this.notifyParticipants(
      ctx,
      { id: appt.id, title: appt.title, staffId: appt.staffId, clientId: appt.clientId },
      CpNotificationType.APPOINTMENT_CANCELLED,
      'Appointment Cancelled',
      `${client.name} cancelled their appointment`
    );

    return { message: 'Appointment cancelled' };
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
      const durationMs = await this.getDefaultDurationMs(workspaceId);
      const endsAt = dto.endsAt
        ? new Date(dto.endsAt)
        : new Date(scheduledAt.getTime() + durationMs);
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
                    gte: new Date(scheduledAt.getTime() - durationMs),
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
    let isRescheduled = false;

    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.reason !== undefined) updateData.reason = dto.reason;
    if (dto.notes !== undefined) updateData.notes = dto.notes;
    if (dto.scheduledAt !== undefined) {
      newScheduledAt = new Date(dto.scheduledAt);
      updateData.scheduledAt = newScheduledAt;
      
      if (newScheduledAt.getTime() !== appt.scheduledAt.getTime()) {
        if (
          ([
            CpAppointmentStatus.PENDING,
            CpAppointmentStatus.CONFIRMED,
            CpAppointmentStatus.RESCHEDULED,
          ] as CpAppointmentStatus[]).includes(appt.status)
        ) {
          isRescheduled = true;
          updateData.status = CpAppointmentStatus.RESCHEDULED;
        }
      }
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
      const durationMs = await this.getDefaultDurationMs(workspaceId);
      const endsAt = checkEndsAt
        ? checkEndsAt
        : new Date(checkScheduledAt.getTime() + durationMs);
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
                    gte: new Date(checkScheduledAt.getTime() - durationMs),
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

    if (isRescheduled) {
      await this.notifyParticipants(
        ctx,
        updated,
        CpNotificationType.APPOINTMENT_RESCHEDULED,
        'Appointment Rescheduled',
        `Appointment "${updated.title}" has been rescheduled to ${newScheduledAt?.toLocaleString()}`
      );
    }

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

    if (appt.status !== dto.status) {
      const allowed = ALLOWED_TRANSITIONS[appt.status] || [];
      if (!allowed.includes(dto.status)) {
        throw new ConflictException(
          `Invalid status transition from ${appt.status} to ${dto.status}`,
        );
      }
    }

    const updated = await this.db.cpAppointment.update({
      where: { id: appointmentId },
      data: { status: dto.status },
    });

    if (appt.status !== updated.status) {
      if (updated.status === 'CONFIRMED') {
        await this.notifyParticipants(
          ctx,
          updated,
          CpNotificationType.APPOINTMENT_CONFIRMED,
          'Appointment Confirmed',
          `Appointment "${updated.title}" has been confirmed`
        );
      } else if (updated.status === 'CANCELLED') {
        await this.notifyParticipants(
          ctx,
          updated,
          CpNotificationType.APPOINTMENT_CANCELLED,
          'Appointment Cancelled',
          `Appointment "${updated.title}" has been cancelled`
        );
      }
    }

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

    const updated = await this.db.cpAppointment.update({
      where: { id: appointmentId },
      data: { deletedAt: new Date(), status: 'CANCELLED' },
    });

    await this.notifyParticipants(
      ctx,
      updated,
      CpNotificationType.APPOINTMENT_CANCELLED,
      'Appointment Cancelled',
      `Appointment "${updated.title}" has been cancelled`
    );

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

  private async getDefaultDurationMs(workspaceId: string): Promise<number> {
    const profile = await this.db.cpCompanyProfile.findUnique({
      where: { workspaceId },
      select: { appointmentDefaults: true },
    });
    const defaults = profile?.appointmentDefaults as
      | Record<string, unknown>
      | undefined;
    const durationMins =
      typeof defaults?.duration === 'number' ? defaults.duration : 60;
    return durationMins * 60 * 1000;
  }

  private async notifyParticipants(
    ctx: CpRequestContext,
    appointment: { id: string; title: string; clientId?: string | null; staffId?: string | null },
    type: CpNotificationType,
    title: string,
    message: string,
  ) {
    if (!ctx.workspaceId) return;

    if (appointment.clientId) {
      const client = await this.db.cpClient.findUnique({
        where: { id: appointment.clientId },
      });
      if (client?.authUserId) {
        void this.notifications.send({
          recipientAuthId: client.authUserId,
          type,
          title,
          message,
          workspaceId: ctx.workspaceId,
          organizationId: ctx.organizationId,
          metadata: { appointmentId: appointment.id },
        });
      }
    }

    if (appointment.staffId) {
      const staff = await this.db.cpStaffProfile.findUnique({
        where: { id: appointment.staffId },
      });
      if (staff?.authUserId) {
        void this.notifications.send({
          recipientAuthId: staff.authUserId,
          type,
          title,
          message,
          workspaceId: ctx.workspaceId,
          organizationId: ctx.organizationId,
          metadata: { appointmentId: appointment.id },
        });
      }
    }
  }
}
