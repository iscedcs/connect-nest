import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  GoneException,
} from '@nestjs/common';
import { Prisma, CpCardStatus, CpLeadSource } from '../../generated/prisma/client';
import { DatabaseService } from '../../database/database.service';
import { CpAuditLogService } from '../audit-logs/cp-audit-log.service';
import { CpRequestContext } from '../types/cp-request.types';
import { CreateCardDto } from './dto/create-card.dto';
import { PairCardDto } from './dto/pair-card.dto';
import { UpdateCardConfigDto } from './dto/update-card-config.dto';
import { UpdateCardStatusDto } from './dto/update-card-status.dto';
import { ListCardsQueryDto } from './dto/list-cards-query.dto';
import { TapCardDto } from './dto/tap-card.dto';
import { AnalyticsQueryDto } from '../analytics/dto/analytics-query.dto';
import { Request } from 'express';

@Injectable()
export class CpConnectCardsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auditLog: CpAuditLogService,
  ) {}

  // ─── Admin: create card ───────────────────────────────────────
  async create(ctx: CpRequestContext, dto: CreateCardDto, req: Request) {
    const workspaceId = ctx.workspaceId!;
    const existing = await this.db.cpConnectCard.findUnique({
      where: { cardCode: dto.cardCode },
    });
    if (existing) throw new ConflictException('Card code already exists');

    const card = await this.db.cpConnectCard.create({
      data: { workspaceId, cardCode: dto.cardCode, status: CpCardStatus.UNASSIGNED },
    });

    this.auditLog.write({
      ctx, req, workspaceId, organizationId: ctx.organizationId,
      eventType: 'CARD_CREATED', targetEntity: 'CpConnectCard',
      targetEntityId: card.id, action: 'CREATE',
      after: card as unknown as Record<string, unknown>,
    });

    return card;
  }

  // ─── Admin: pair card ─────────────────────────────────────────
  async pair(ctx: CpRequestContext, cardId: string, dto: PairCardDto, req: Request) {
    const workspaceId = ctx.workspaceId!;

    const card = await this.db.cpConnectCard.findFirst({
      where: { id: cardId, workspaceId },
    });
    if (!card) throw new NotFoundException('Card not found in workspace');

    // Validate staffId is an ACTIVE STAFF in this workspace
    const staffProfile = await this.db.cpStaffProfile.findFirst({
      where: { id: dto.staffId, workspaceId },
      include: { member: { select: { status: true, role: true } } },
    });
    if (!staffProfile || staffProfile.deletedAt)
      throw new NotFoundException('Staff not found in workspace');
    if (staffProfile.member.status !== 'ACTIVE')
      throw new ForbiddenException('Staff member is not active');

    // Validate no other ACTIVE card is already assigned to this staff
    const existingAssignment = await this.db.cpConnectCard.findFirst({
      where: { staffId: dto.staffId, status: CpCardStatus.ACTIVE },
    });
    if (existingAssignment && existingAssignment.id !== cardId) {
      throw new ConflictException('Staff already has an active card');
    }

    // Optionally verify DeviceProfile exists
    if (dto.deviceId) {
      const device = await this.db.deviceProfile.findUnique({
        where: { deviceId: dto.deviceId },
      });
      if (!device) throw new NotFoundException('DeviceProfile not found for deviceId');
    }

    const before = card;
    const updated = await this.db.cpConnectCard.update({
      where: { id: cardId },
      data: {
        staffId: dto.staffId,
        deviceId: dto.deviceId ?? null,
        status: CpCardStatus.ACTIVE,
        pairedBy: ctx.authUserId,
        pairedAt: new Date(),
      },
    });

    this.auditLog.write({
      ctx, req, workspaceId, organizationId: ctx.organizationId,
      eventType: 'CARD_PAIRED', targetEntity: 'CpConnectCard',
      targetEntityId: cardId, action: 'UPDATE',
      before: before as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  // ─── Admin: unpair card ───────────────────────────────────────
  async unpair(ctx: CpRequestContext, cardId: string, req: Request) {
    const workspaceId = ctx.workspaceId!;
    const card = await this.db.cpConnectCard.findFirst({
      where: { id: cardId, workspaceId },
    });
    if (!card) throw new NotFoundException('Card not found');

    const updated = await this.db.cpConnectCard.update({
      where: { id: cardId },
      data: {
        staffId: null,
        deviceId: null,
        status: CpCardStatus.UNASSIGNED,
        pairedBy: null,
        pairedAt: null,
      },
    });

    this.auditLog.write({
      ctx, req, workspaceId, organizationId: ctx.organizationId,
      eventType: 'CARD_UNPAIRED', targetEntity: 'CpConnectCard',
      targetEntityId: cardId, action: 'UPDATE',
      before: card as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  // ─── Admin: update tap config ─────────────────────────────────
  async updateConfig(ctx: CpRequestContext, cardId: string, dto: UpdateCardConfigDto, req: Request) {
    const workspaceId = ctx.workspaceId!;
    const card = await this.db.cpConnectCard.findFirst({
      where: { id: cardId, workspaceId },
    });
    if (!card) throw new NotFoundException('Card not found');

    const updated = await this.db.cpConnectCard.update({
      where: { id: cardId },
      data: { tapConfig: dto.tapConfig as unknown as Prisma.InputJsonValue },
    });

    this.auditLog.write({
      ctx, req, workspaceId, organizationId: ctx.organizationId,
      eventType: 'CARD_CONFIG_UPDATED', targetEntity: 'CpConnectCard',
      targetEntityId: cardId, action: 'UPDATE',
      before: card as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  // ─── Admin: update card status ────────────────────────────────
  async updateStatus(ctx: CpRequestContext, cardId: string, dto: UpdateCardStatusDto, req: Request) {
    const workspaceId = ctx.workspaceId!;
    if (dto.status === CpCardStatus.UNASSIGNED) {
      throw new ForbiddenException('Cannot set status back to UNASSIGNED via this endpoint');
    }

    const card = await this.db.cpConnectCard.findFirst({
      where: { id: cardId, workspaceId },
    });
    if (!card) throw new NotFoundException('Card not found');

    const updateData: Prisma.CpConnectCardUpdateInput = { status: dto.status };
    if (dto.status === CpCardStatus.LOST) {
      updateData.deviceId = null;
    }

    const updated = await this.db.cpConnectCard.update({
      where: { id: cardId },
      data: updateData,
    });

    this.auditLog.write({
      ctx, req, workspaceId, organizationId: ctx.organizationId,
      eventType: 'CARD_STATUS_CHANGED', targetEntity: 'CpConnectCard',
      targetEntityId: cardId, action: 'UPDATE',
      before: card as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  // ─── Admin: list cards ────────────────────────────────────────
  async list(ctx: CpRequestContext, query: ListCardsQueryDto) {
    const where: Prisma.CpConnectCardWhereInput = { workspaceId: ctx.workspaceId! };
    if (query.status) where.status = query.status as CpCardStatus;

    return this.db.cpConnectCard.findMany({
      where,
      include: {
        staff: { select: { id: true, name: true, photo: true, jobTitle: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Public: tap ─────────────────────────────────────────────
  async tap(cardCode: string, dto: TapCardDto, req: Request) {
    const card = await this.db.cpConnectCard.findUnique({
      where: { cardCode },
      include: {
        workspace: { select: { id: true, status: true } },
        staff: {
          select: { id: true, name: true, photo: true, jobTitle: true, department: true, authUserId: true },
        },
      },
    });

    if (!card) throw new NotFoundException('Card not found');
    if (card.status === CpCardStatus.SUSPENDED || card.status === CpCardStatus.LOST) {
      throw new GoneException('Card is no longer active');
    }

    if (!card.workspace || card.workspace.status !== 'ACTIVE') {
      throw new NotFoundException('Workspace not found or inactive');
    }

    const companyProfile = await this.db.cpCompanyProfile.findUnique({
      where: { workspaceId: card.workspaceId },
      select: { name: true, logo: true, contactEmail: true, contactPhone: true },
    });

    // Best-effort CardInteraction — requires a Profile.userId for the FK
    if (card.staff?.authUserId) {
      const profile = await this.db.profile.findFirst({
        where: { userId: card.staff.authUserId },
      });
      if (profile) {
        await this.db.cardInteraction.create({
          data: {
            userId: profile.id,
            deviceId: card.cardCode,
            method: 'TAP',
            workspaceId: card.workspaceId,
            workspaceMemberId: card.staffId ?? undefined,
            deviceType: (req.headers['x-device-type'] as string) ?? null,
          },
        }).catch(() => {});
      }
    }

    // Upsert lead if visitor email provided
    let leadId: string | null = null;
    if (dto.visitorEmail) {
      const existing = await this.db.cpLead.findFirst({
        where: { workspaceId: card.workspaceId, email: dto.visitorEmail, deletedAt: null },
      });
      if (existing) {
        leadId = existing.id;
      } else {
        const lead = await this.db.cpLead.create({
          data: {
            workspaceId: card.workspaceId,
            name: dto.visitorName ?? dto.visitorEmail,
            email: dto.visitorEmail,
            phone: dto.visitorPhone ?? undefined,
            source: CpLeadSource.CARD_TAP,
          },
        });
        leadId = lead.id;
      }
    }

    this.auditLog.write({
      ctx: null,
      workspaceId: card.workspaceId,
      eventType: 'CARD_TAPPED',
      targetEntity: 'CpConnectCard',
      targetEntityId: card.id,
      action: 'TAP',
      metadata: { cardCode, visitorEmail: dto.visitorEmail ?? null } as unknown as Record<string, unknown>,
    });

    return {
      tapConfig: card.tapConfig,
      staff: card.staff
        ? {
            name: card.staff.name,
            photo: card.staff.photo,
            jobTitle: card.staff.jobTitle,
            department: card.staff.department,
          }
        : null,
      workspace: {
        name: companyProfile?.name ?? card.workspace.id,
        logo: companyProfile?.logo ?? null,
        contactEmail: companyProfile?.contactEmail ?? null,
        contactPhone: companyProfile?.contactPhone ?? null,
      },
      leadId,
    };
  }

  // ─── Analytics ───────────────────────────────────────────────
  async getAnalytics(ctx: CpRequestContext, query: AnalyticsQueryDto) {
    const workspaceId = ctx.workspaceId!;

    const dateFilter: Prisma.CpAuditLogWhereInput['createdAt'] = {};
    if (query.from) dateFilter.gte = new Date(query.from);
    if (query.to) dateFilter.lte = new Date(query.to + 'T23:59:59.999Z');

    const tapLogs = await this.db.cpAuditLog.findMany({
      where: {
        workspaceId,
        eventType: 'CARD_TAPPED',
        ...(query.from || query.to ? { createdAt: dateFilter } : {}),
      },
      select: {
        targetEntityId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const totalTaps = tapLogs.length;

    // Top cards by tap count
    const tapsByCard: Record<string, number> = {};
    for (const log of tapLogs) {
      tapsByCard[log.targetEntityId] = (tapsByCard[log.targetEntityId] ?? 0) + 1;
    }

    const topCards = Object.entries(tapsByCard)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([cardId, count]) => ({ cardId, taps: count }));

    // Taps by hour-of-day (0–23)
    const tapsByHour: Record<number, number> = {};
    for (let h = 0; h < 24; h++) tapsByHour[h] = 0;
    for (const log of tapLogs) {
      const hour = log.createdAt.getUTCHours();
      tapsByHour[hour]++;
    }

    // Taps by day-of-week (0=Sun, 6=Sat)
    const tapsByDow: Record<number, number> = {};
    for (let d = 0; d < 7; d++) tapsByDow[d] = 0;
    for (const log of tapLogs) {
      const dow = log.createdAt.getUTCDay();
      tapsByDow[dow]++;
    }

    return {
      totalTaps,
      topCards,
      tapsByHour: Object.entries(tapsByHour).map(([h, count]) => ({
        hour: Number(h),
        count,
      })),
      tapsByDayOfWeek: Object.entries(tapsByDow).map(([d, count]) => ({
        day: Number(d),
        count,
      })),
    };
  }
}
