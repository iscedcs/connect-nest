import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CpRequestContext } from '../types/cp-request.types';
import { CpAuditLogService } from '../audit-logs/cp-audit-log.service';
import { CpNotificationsService } from '../notifications/notifications.service';
import { CpRole } from '../../generated/prisma/client';
import { AssignClientDto } from './dto/assign-client.dto';
import { InviteClientDto } from './dto/invite-client.dto';
import { PaginateQueryDto } from '../common/dto/paginate-query.dto';
import { paginateResult } from '../utils/paginate';
import { Request } from 'express';
import { randomBytes, createHash } from 'crypto';
import { IsceAuthService } from '../isce-auth/isce-auth.service';
import { CpNotificationType } from '../../generated/prisma/client';

@Injectable()
export class CpClientsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auditLog: CpAuditLogService,
    private readonly notifications: CpNotificationsService,
    private readonly isceAuth: IsceAuthService,
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
      include: { lead: true, assignedStaff: true },
    });
    if (!client) throw new NotFoundException('Client profile not found');
    return client;
  }

  async list(ctx: CpRequestContext, query: PaginateQueryDto) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId)
      throw new ForbiddenException('Workspace context required');

    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [data, total] = await this.db.$transaction([
      this.db.cpClient.findMany({
        where: { workspaceId, deletedAt: null },
        include: { lead: true, member: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.cpClient.count({ where: { workspaceId, deletedAt: null } }),
    ]);

    return paginateResult(data, total, page, limit);
  }

  async listAssigned(ctx: CpRequestContext, query: PaginateQueryDto) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId)
      throw new ForbiddenException('Workspace context required');

    // Get staff profile for this member
    const staffProfile = await this.db.cpStaffProfile.findFirst({
      where: { workspaceId, memberId: ctx.memberId, deletedAt: null },
    });
    if (!staffProfile) throw new NotFoundException('Staff profile not found');

    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [data, total] = await this.db.$transaction([
      this.db.cpClient.findMany({
        where: {
          workspaceId,
          assignedStaffId: staffProfile.id,
          deletedAt: null,
        },
        include: { lead: true, member: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.cpClient.count({
        where: {
          workspaceId,
          assignedStaffId: staffProfile.id,
          deletedAt: null,
        },
      }),
    ]);

    return paginateResult(data, total, page, limit);
  }

  async findById(ctx: CpRequestContext, clientId: string) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId)
      throw new ForbiddenException('Workspace context required');

    const client = await this.db.cpClient.findFirst({
      where: { id: clientId, workspaceId, deletedAt: null },
      include: { lead: true, assignedStaff: true, member: true },
    });
    if (!client) throw new NotFoundException('Client not found');

    // STAFF can only access their assigned clients
    if (ctx.role === CpRole.STAFF) {
      const staffProfile = await this.db.cpStaffProfile.findFirst({
        where: { workspaceId, memberId: ctx.memberId },
      });
      if (!staffProfile || client.assignedStaffId !== staffProfile.id) {
        throw new ForbiddenException('Access denied');
      }
    }

    return client;
  }

  async assign(
    ctx: CpRequestContext,
    clientId: string,
    dto: AssignClientDto,
    req: Request,
  ) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId)
      throw new ForbiddenException('Workspace context required');

    const client = await this.db.cpClient.findFirst({
      where: { id: clientId, workspaceId, deletedAt: null },
    });
    if (!client) throw new NotFoundException('Client not found');

    let assignedStaffAuthId: string | null = null;
    if (dto.assignedStaffId) {
      const staffProfile = await this.db.cpStaffProfile.findFirst({
        where: { id: dto.assignedStaffId, workspaceId, deletedAt: null },
      });
      if (!staffProfile) throw new NotFoundException('Staff profile not found');
      assignedStaffAuthId = staffProfile.authUserId;
    }

    const updated = await this.db.cpClient.update({
      where: { id: clientId },
      data: { assignedStaffId: dto.assignedStaffId ?? null },
    });

    if (assignedStaffAuthId) {
      const conversation = await this.db.cpConversation.findFirst({
        where: { clientId, type: 'CLIENT_STAFF' },
      });

      if (conversation) {
        const existingParticipant = await this.db.cpConversationParticipant.findFirst({
          where: { conversationId: conversation.id, authUserId: assignedStaffAuthId },
        });

        if (!existingParticipant) {
          await this.db.cpConversationParticipant.create({
            data: {
              conversationId: conversation.id,
              authUserId: assignedStaffAuthId,
              role: 'MEMBER',
            },
          });
        }
      }

      this.notifications.send({
        recipientAuthId: assignedStaffAuthId,
        type: CpNotificationType.LEAD_ASSIGNED,
        title: 'Client Assigned',
        message: `You have been assigned to client: ${client.name}`,
        workspaceId,
        organizationId: ctx.organizationId,
      });
    }

    this.auditLog.write({
      ctx,
      req,
      workspaceId,
      organizationId: ctx.organizationId,
      eventType: 'CLIENT_ASSIGNED',
      targetEntity: 'CpClient',
      targetEntityId: clientId,
      action: 'UPDATE',
      before: { assignedStaffId: client.assignedStaffId } as Record<
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

  async inviteClient(
    ctx: CpRequestContext,
    clientId: string,
    dto: InviteClientDto,
    req: Request,
  ) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId) throw new ForbiddenException('Workspace context required');

    const client = await this.db.cpClient.findFirst({
      where: { id: clientId, workspaceId, deletedAt: null },
    });
    if (!client) throw new NotFoundException('Client not found');

    if (client.authUserId) {
      // Already registered, but we could allow resending, though usually they'd just login.
    }

    // Update client email if not present or different
    if (client.email !== dto.email) {
      await this.db.cpClient.update({
        where: { id: clientId },
        data: { email: dto.email },
      });
    }

    const inviterMember = await this.db.cpWorkspaceMember.findFirst({
      where: { workspaceId, authUserId: ctx.authUserId },
    });
    if (!inviterMember) throw new ForbiddenException('Inviter is not a workspace member');

    const rawToken = randomBytes(32).toString('hex');
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = await this.db.cpWorkspaceInvite.create({
      data: {
        workspaceId,
        email: dto.email,
        role: CpRole.CLIENT,
        token: hashedToken,
        status: 'PENDING',
        invitedById: inviterMember.id,
        expiresAt,
      },
    });

    void this.isceAuth.sendClientInvite({
      email: dto.email,
      token: rawToken,
      clientId: client.id,
    });

    this.auditLog.write({
      ctx,
      req,
      workspaceId,
      organizationId: ctx.organizationId,
      eventType: 'CLIENT_INVITED',
      targetEntity: 'CpClient',
      targetEntityId: client.id,
      action: 'SEND',
      after: { email: dto.email, inviteId: invite.id } as Record<string, unknown>,
    });

    this.notifications.send({
      recipientAuthId: ctx.authUserId,
      type: CpNotificationType.CLIENT_INVITED,
      title: 'Client Invite Sent',
      message: `You invited ${dto.email} to join as a client.`,
      workspaceId,
      organizationId: ctx.organizationId,
    });

    return { message: 'Client invitation sent', inviteId: invite.id };
  }
}
