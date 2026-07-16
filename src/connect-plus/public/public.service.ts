import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CpLeadSource, CpAppointmentType, CpNotificationType } from '../../generated/prisma/client';
import { BookAppointmentDto } from './dto/book-appointment.dto';
import { SaveContactDto } from './dto/save-contact.dto';
import { RecordInteractionDto } from './dto/record-interaction.dto';
import { CpNotificationsService } from '../notifications/notifications.service';
import { MailClientService } from '../../mail/mail-client.service';

@Injectable()
export class CpPublicService {
  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: CpNotificationsService,
    private readonly mailClient: MailClientService,
  ) {}

  async getPublicProfile(workspaceSlug: string) {
    const workspace = await this.db.cpWorkspace.findUnique({
      where: { slug: workspaceSlug },
      include: { companyProfile: true },
    });
    if (!workspace || workspace.deletedAt || workspace.status !== 'ACTIVE') {
      throw new NotFoundException('Workspace not found or inactive');
    }

    const profile = workspace.companyProfile;
    return {
      workspaceId: workspace.id,
      name: profile?.name ?? workspace.name,
      logo: profile?.logo ?? null,
      description: profile?.description ?? null,
      contactEmail: profile?.contactEmail ?? null,
      contactPhone: profile?.contactPhone ?? null,
      address: profile?.address ?? null,
      businessHours: profile?.businessHours ?? null,
    };
  }

  async bookAppointment(workspaceSlug: string, dto: BookAppointmentDto) {
    const workspace = await this.db.cpWorkspace.findUnique({
      where: { slug: workspaceSlug },
    });
    if (!workspace || workspace.deletedAt || workspace.status !== 'ACTIVE') {
      throw new NotFoundException('Workspace not found or inactive');
    }

    if (dto.staffId) {
      const staff = await this.db.cpStaffProfile.findUnique({
        where: { id: dto.staffId },
      });
      if (!staff || staff.workspaceId !== workspace.id || staff.deletedAt) {
        throw new BadRequestException('Invalid staff ID for this workspace');
      }

      if (dto.scheduledAt) {
        const scheduledAt = new Date(dto.scheduledAt);
        const profile = await this.db.cpCompanyProfile.findUnique({
          where: { workspaceId: workspace.id },
          select: { appointmentDefaults: true },
        });
        const defaults = profile?.appointmentDefaults as Record<string, unknown> | undefined;
        const durationMins = typeof defaults?.duration === 'number' ? defaults.duration : 60;
        const durationMs = durationMins * 60 * 1000;

        // Use endsAt if provided in DTO (requires updating DTO if it supports it, assuming it does based on ref), otherwise calculate
        const endsAt = (dto as any).endsAt
          ? new Date((dto as any).endsAt)
          : new Date(scheduledAt.getTime() + durationMs);

        const conflicting = await this.db.cpAppointment.findFirst({
          where: {
            workspaceId: workspace.id,
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
    }

    // Create lead
    const lead = await this.db.cpLead.create({
      data: {
        workspaceId: workspace.id,
        name: dto.name,
        email: dto.email,
        phone: dto.phone ?? undefined,
        source: CpLeadSource.FORM_SUBMIT,
        assignedStaffId: dto.staffId ?? undefined,
      },
    });

    // Create appointment linked to lead
    const appointment = await this.db.cpAppointment.create({
      data: {
        workspaceId: workspace.id,
        type: CpAppointmentType.PUBLIC,
        leadId: lead.id,
        staffId: dto.staffId ?? undefined,
        title: dto.title,
        reason: dto.reason ?? undefined,
        scheduledAt: new Date(dto.scheduledAt),
      },
    });

    if (dto.email) {
      void this.mailClient.sendEmail({
        to: dto.email,
        subject: 'Appointment Confirmation',
        html: `<p>Hi ${dto.name}, your appointment "${dto.title}" has been successfully booked.</p>`,
      });
    }

    await this.notifyStaffAndAdmins(
      workspace.id,
      CpNotificationType.APPOINTMENT_BOOKED,
      'New Appointment Booked',
      `${dto.name} booked an appointment: ${dto.title}`,
      dto.staffId ?? undefined,
    );

    return { leadId: lead.id, appointmentId: appointment.id };
  }

  async saveContact(workspaceSlug: string, dto: SaveContactDto) {
    const workspace = await this.db.cpWorkspace.findUnique({
      where: { slug: workspaceSlug },
    });
    if (!workspace || workspace.deletedAt || workspace.status !== 'ACTIVE') {
      throw new NotFoundException('Workspace not found or inactive');
    }

    const lead = await this.db.cpLead.create({
      data: {
        workspaceId: workspace.id,
        name: dto.name ?? dto.email ?? dto.phone ?? 'Unknown',
        email: dto.email ?? undefined,
        phone: dto.phone ?? undefined,
        notes: dto.notes ?? undefined,
        source: CpLeadSource.FORM_SUBMIT,
      },
    });

    await this.notifyStaffAndAdmins(
      workspace.id,
      CpNotificationType.NEW_LEAD,
      'New Lead Captured',
      `${dto.name ?? dto.email ?? dto.phone ?? 'Someone'} submitted their contact info.`,
    );

    return { leadId: lead.id };
  }

  async recordInteraction(
    workspaceSlug: string,
    dto: RecordInteractionDto,
    ip?: string,
  ) {
    const workspace = await this.db.cpWorkspace.findUnique({
      where: { slug: workspaceSlug },
    });
    if (!workspace || workspace.deletedAt || workspace.status !== 'ACTIVE') {
      throw new NotFoundException('Workspace not found or inactive');
    }

    // Best-effort: log interaction if entity profile id is provided
    if (dto.entityId) {
      try {
        await this.db.cardInteraction.create({
          data: {
            userId: dto.entityId,
            deviceId: ip ?? 'public',
            method: dto.type === 'CARD_TAP' ? 'TAP' : 'SCAN',
            workspaceId: workspace.id,
          },
        });
      } catch {
        // Non-critical — ignore DB error for interaction logging
      }
    }

    return { ok: true };
  }

  private async notifyStaffAndAdmins(
    workspaceId: string,
    type: CpNotificationType,
    title: string,
    message: string,
    assignedStaffId?: string,
  ) {
    const members = await this.db.cpWorkspaceMember.findMany({
      where: {
        workspaceId,
        role: { in: ['WORKSPACE_ADMIN', 'CREATOR'] },
        status: 'ACTIVE',
      },
      select: { authUserId: true },
    });

    const authIds = new Set(members.map((m) => m.authUserId));

    if (assignedStaffId) {
      const staff = await this.db.cpStaffProfile.findUnique({
        where: { id: assignedStaffId },
      });
      if (staff?.authUserId) {
        authIds.add(staff.authUserId);
      }
    }

    for (const authUserId of authIds) {
      void this.notifications.send({
        recipientAuthId: authUserId,
        type,
        title,
        message,
        workspaceId,
      });
    }
  }
}
