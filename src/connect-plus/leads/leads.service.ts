import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { CpRequestContext } from '../types/cp-request.types';
import { CpAuditLogService } from '../audit-logs/cp-audit-log.service';
import { CpNotificationsService } from '../notifications/notifications.service';
import { IsceAuthService } from '../isce-auth/isce-auth.service';
import {
  CpRole,
  CpMemberStatus,
  CpNotificationType,
} from '../../generated/prisma/client';
import { CpSubscriptionsService } from '../subscriptions/subscriptions.service';
import { ListLeadsQueryDto } from './dto/list-leads-query.dto';
import { AssignLeadDto } from './dto/assign-lead.dto';
import { RejectLeadDto } from './dto/reject-lead.dto';
import { paginateResult } from '../utils/paginate';
import { Request } from 'express';

@Injectable()
export class CpLeadsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auditLog: CpAuditLogService,
    private readonly notifications: CpNotificationsService,
    private readonly isceAuth: IsceAuthService,
    private readonly subscriptions: CpSubscriptionsService,
  ) {}

  async list(ctx: CpRequestContext, query: ListLeadsQueryDto) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId)
      throw new ForbiddenException('Workspace context required');

    const page = parseInt(query.page ?? '1', 10) || 1;
    const limit = Math.min(parseInt(query.limit ?? '20', 10) || 20, 100);
    const skip = (page - 1) * limit;

    const where = {
      workspaceId,
      deletedAt: null as Date | null,
      ...(query.status ? { status: query.status } : {}),
    };

    const [data, total] = await this.db.$transaction([
      this.db.cpLead.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.cpLead.count({ where }),
    ]);

    return paginateResult(data, total, page, limit);
  }

  async findById(ctx: CpRequestContext, leadId: string) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId)
      throw new ForbiddenException('Workspace context required');

    const lead = await this.db.cpLead.findFirst({
      where: { id: leadId, workspaceId, deletedAt: null },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async assign(
    ctx: CpRequestContext,
    leadId: string,
    dto: AssignLeadDto,
    req: Request,
  ) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId)
      throw new ForbiddenException('Workspace context required');

    const lead = await this.db.cpLead.findFirst({
      where: { id: leadId, workspaceId, deletedAt: null },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    // Validate staff if provided
    if (dto.assignedStaffId) {
      const staffProfile = await this.db.cpStaffProfile.findFirst({
        where: { id: dto.assignedStaffId, workspaceId, deletedAt: null },
      });
      if (!staffProfile) throw new NotFoundException('Staff profile not found');
    }

    const updated = await this.db.cpLead.update({
      where: { id: leadId },
      data: { assignedStaffId: dto.assignedStaffId ?? null },
    });

    this.auditLog.write({
      ctx,
      req,
      workspaceId,
      organizationId: ctx.organizationId,
      eventType: 'LEAD_ASSIGNED',
      targetEntity: 'CpLead',
      targetEntityId: leadId,
      action: 'UPDATE',
      before: { assignedStaffId: lead.assignedStaffId } as Record<
        string,
        unknown
      >,
      after: { assignedStaffId: dto.assignedStaffId } as Record<
        string,
        unknown
      >,
    });

    return updated;
  }

  async validate(ctx: CpRequestContext, leadId: string, req: Request) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId)
      throw new ForbiddenException('Workspace context required');

    const lead = await this.db.cpLead.findFirst({
      where: { id: leadId, workspaceId, deletedAt: null },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.status === 'CONVERTED') {
      throw new BadRequestException('Lead has already been converted');
    }

    // Plan limit check for clients
    const limitCheck = await this.subscriptions.checkLimit(
      ctx.organizationId,
      'client',
      workspaceId,
    );
    if (!limitCheck.allowed) {
      throw new ForbiddenException(
        `Plan limit reached (${limitCheck.current}/${limitCheck.limit} clients). Upgrade your subscription.`,
      );
    }

    // Look up assigned staff profile for conversation participant
    let staffProfile: { id: string; authUserId: string } | null = null;
    if (lead.assignedStaffId) {
      staffProfile = await this.db.cpStaffProfile.findFirst({
        where: { id: lead.assignedStaffId, workspaceId },
        select: { id: true, authUserId: true },
      });
    }

    // BL-2 transaction
    const result = await this.db.$transaction(async (tx) => {
      const member = await tx.cpWorkspaceMember.create({
        data: {
          workspaceId,
          authUserId: null,
          role: CpRole.CLIENT,
          status: CpMemberStatus.ACTIVE,
          invitedBy: ctx.authUserId,
        },
      });

      const client = await tx.cpClient.create({
        data: {
          workspaceId,
          memberId: member.id,
          leadId,
          name: lead.name,
          email: lead.email ?? undefined,
          phone: lead.phone ?? undefined,
          assignedStaffId: lead.assignedStaffId ?? undefined,
        },
      });

      await tx.cpLead.update({
        where: { id: leadId },
        data: { status: 'CONVERTED', convertedAt: new Date() },
      });

      const conversation = await tx.cpConversation.create({
        data: {
          type: 'CLIENT_STAFF',
          workspaceId,
          clientId: client.id,
          isAutoCreated: true,
        },
      });

      if (staffProfile?.authUserId) {
        await tx.cpConversationParticipant.create({
          data: {
            conversationId: conversation.id,
            authUserId: staffProfile.authUserId,
            role: 'MEMBER',
          },
        });
      }

      return { member, client, conversation };
    });

    // Non-blocking: send client invite via isce-auth
    if (lead.email) {
      const rawToken = randomBytes(32).toString('hex');
      void this.isceAuth.sendClientInvite({
        email: lead.email,
        token: rawToken,
        clientId: result.client.id,
      });
    }

    this.auditLog.write({
      ctx,
      req,
      workspaceId,
      organizationId: ctx.organizationId,
      eventType: 'LEAD_CONVERTED',
      targetEntity: 'CpLead',
      targetEntityId: leadId,
      action: 'UPDATE',
      before: { status: lead.status } as Record<string, unknown>,
      after: { status: 'CONVERTED', clientId: result.client.id } as Record<
        string,
        unknown
      >,
    });

    return {
      clientId: result.client.id,
      conversationId: result.conversation.id,
    };
  }

  async reject(
    ctx: CpRequestContext,
    leadId: string,
    dto: RejectLeadDto,
    req: Request,
  ) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId)
      throw new ForbiddenException('Workspace context required');

    const lead = await this.db.cpLead.findFirst({
      where: { id: leadId, workspaceId, deletedAt: null },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    const updated = await this.db.cpLead.update({
      where: { id: leadId },
      data: {
        status: 'REJECTED',
        notes: dto.reason
          ? `${lead.notes ? lead.notes + '\n' : ''}Rejection reason: ${dto.reason}`
          : lead.notes,
      },
    });

    this.auditLog.write({
      ctx,
      req,
      workspaceId,
      organizationId: ctx.organizationId,
      eventType: 'LEAD_REJECTED',
      targetEntity: 'CpLead',
      targetEntityId: leadId,
      action: 'UPDATE',
      before: { status: lead.status } as Record<string, unknown>,
      after: { status: 'REJECTED' } as Record<string, unknown>,
    });

    return updated;
  }

  async remove(ctx: CpRequestContext, leadId: string, req: Request) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId)
      throw new ForbiddenException('Workspace context required');

    const lead = await this.db.cpLead.findFirst({
      where: { id: leadId, workspaceId, deletedAt: null },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    await this.db.cpLead.update({
      where: { id: leadId },
      data: { deletedAt: new Date() },
    });

    this.auditLog.write({
      ctx,
      req,
      workspaceId,
      organizationId: ctx.organizationId,
      eventType: 'LEAD_DELETED',
      targetEntity: 'CpLead',
      targetEntityId: leadId,
      action: 'DELETE',
      before: lead as Record<string, unknown>,
    });

    return { message: 'Lead deleted' };
  }
}
