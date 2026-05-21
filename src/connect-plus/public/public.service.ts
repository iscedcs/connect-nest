import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  CpLeadSource,
  CpAppointmentType,
} from '../../generated/prisma/client';
import { BookAppointmentDto } from './dto/book-appointment.dto';
import { SaveContactDto } from './dto/save-contact.dto';
import { RecordInteractionDto } from './dto/record-interaction.dto';

@Injectable()
export class CpPublicService {
  constructor(private readonly db: DatabaseService) {}

  async getPublicProfile(workspaceSlug: string) {
    const workspace = await this.db.cpWorkspace.findUnique({
      where: { slug: workspaceSlug },
      include: { companyProfile: true },
    });
    if (!workspace || workspace.deletedAt) {
      throw new NotFoundException('Workspace not found');
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
    if (!workspace || workspace.deletedAt) {
      throw new NotFoundException('Workspace not found');
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

    return { leadId: lead.id, appointmentId: appointment.id };
  }

  async saveContact(workspaceSlug: string, dto: SaveContactDto) {
    const workspace = await this.db.cpWorkspace.findUnique({
      where: { slug: workspaceSlug },
    });
    if (!workspace || workspace.deletedAt) {
      throw new NotFoundException('Workspace not found');
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

    return { leadId: lead.id };
  }

  async recordInteraction(workspaceSlug: string, dto: RecordInteractionDto, ip?: string) {
    const workspace = await this.db.cpWorkspace.findUnique({
      where: { slug: workspaceSlug },
    });
    if (!workspace || workspace.deletedAt) {
      throw new NotFoundException('Workspace not found');
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
}

