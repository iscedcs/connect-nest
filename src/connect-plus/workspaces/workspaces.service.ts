import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { CpRequestContext, IsceAuthPayload } from '../types/cp-request.types';
import { CpAuditLogService } from '../audit-logs/cp-audit-log.service';
import { CpNotificationsService } from '../notifications/notifications.service';
import { IsceAuthService } from '../isce-auth/isce-auth.service';
import { toSlug, toSlugWithSuffix } from '../utils/slug';
import {
  CpRole,
  CpNotificationType,
  CpWorkspaceStatus,
} from '../../generated/prisma/client';
import { CpSubscriptionsService } from '../subscriptions/subscriptions.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { UpdateWorkspaceStatusDto } from './dto/update-workspace-status.dto';
import { InviteAdminDto } from './dto/invite-admin.dto';
import { Request } from 'express';

@Injectable()
export class CpWorkspacesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auditLog: CpAuditLogService,
    private readonly notifications: CpNotificationsService,
    private readonly isceAuth: IsceAuthService,
    private readonly subscriptions: CpSubscriptionsService,
  ) {}

  async create(
    ctx: CpRequestContext,
    dto: CreateWorkspaceDto,
    req?: Request & { isce_auth?: IsceAuthPayload },
  ) {
    const limitCheck = await this.subscriptions.checkLimit(
      ctx.organizationId,
      'workspace',
    );
    if (!limitCheck.allowed) {
      throw new ForbiddenException(
        `Plan limit reached (${limitCheck.current}/${limitCheck.limit} workspaces). Upgrade your subscription.`,
      );
    }

    const slug = await this.generateWorkspaceSlug(dto.name);

    const workspace = await this.db.cpWorkspace.create({
      data: {
        organizationId: ctx.organizationId,
        name: dto.name,
        slug,
      },
    });

    // Auto-create workspace group conversation (BL-3)
    await this.db.cpConversation.create({
      data: {
        workspaceId: workspace.id,
        type: 'WORKSPACE_GROUP',
        name: `${dto.name} - General`,
        isAutoCreated: true,
      },
    });

    // Auto-create company profile
    await this.db.cpCompanyProfile.create({
      data: {
        workspaceId: workspace.id,
        name: dto.name,
      },
    });

    // Auto-create workspace member + staff profile for creator
    const creatorAuth = req?.isce_auth;
    const creatorName = creatorAuth
      ? [creatorAuth.firstName, creatorAuth.lastName].filter(Boolean).join(' ') ||
        creatorAuth.email.split('@')[0]
      : ctx.authUserId;

    const creatorMember = await this.db.cpWorkspaceMember.create({
      data: {
        workspaceId: workspace.id,
        authUserId: ctx.authUserId,
        role: CpRole.CREATOR,
        status: 'ACTIVE',
        joinedAt: new Date(),
      },
    });

    await this.db.cpStaffProfile.create({
      data: {
        workspaceId: workspace.id,
        memberId: creatorMember.id,
        authUserId: ctx.authUserId,
        name: creatorName,
        email: creatorAuth?.email ?? undefined,
        photo: creatorAuth?.displayPicture ?? undefined,
      },
    });

    this.auditLog.write({
      ctx,
      req,
      organizationId: ctx.organizationId,
      workspaceId: workspace.id,
      eventType: 'WORKSPACE_CREATED',
      targetEntity: 'CpWorkspace',
      targetEntityId: workspace.id,
      action: 'CREATE',
      after: workspace as Record<string, unknown>,
    });

    return workspace;
  }

  async list(ctx: CpRequestContext) {
    return this.db.cpWorkspace.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(ctx: CpRequestContext, workspaceId: string) {
    const workspace = await this.db.cpWorkspace.findFirst({
      where: {
        id: workspaceId,
        organizationId: ctx.organizationId,
      },
      include: {
        companyProfile: true,
        _count: {
          select: { members: true, leads: true, clients: true },
        },
      },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    return workspace;
  }

  async update(
    ctx: CpRequestContext,
    workspaceId: string,
    dto: UpdateWorkspaceDto,
    req: Request,
  ) {
    const workspace = await this.resolveWorkspace(ctx, workspaceId);

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) {
      updateData.name = dto.name;
      updateData.slug = await this.generateWorkspaceSlug(dto.name);
    }
    if (dto.settings !== undefined) updateData.settings = dto.settings;

    const updated = await this.db.cpWorkspace.update({
      where: { id: workspace.id },
      data: updateData,
    });

    this.auditLog.write({
      ctx,
      req,
      workspaceId: workspace.id,
      organizationId: ctx.organizationId,
      eventType: 'WORKSPACE_UPDATED',
      targetEntity: 'CpWorkspace',
      targetEntityId: workspace.id,
      action: 'UPDATE',
      before: workspace as Record<string, unknown>,
      after: updated as Record<string, unknown>,
    });

    return updated;
  }

  async updateStatus(
    ctx: CpRequestContext,
    workspaceId: string,
    dto: UpdateWorkspaceStatusDto,
    req: Request,
  ) {
    const workspace = await this.resolveWorkspace(ctx, workspaceId);

    const currentStatus = workspace.status;
    const newStatus = dto.status;

    if (currentStatus === newStatus) {
      return workspace;
    }

    let isValid = false;
    if (currentStatus === CpWorkspaceStatus.ACTIVE) {
      if (newStatus === CpWorkspaceStatus.SUSPENDED || newStatus === CpWorkspaceStatus.ARCHIVED) isValid = true;
    } else if (currentStatus === CpWorkspaceStatus.SUSPENDED) {
      if (newStatus === CpWorkspaceStatus.ACTIVE) isValid = true;
    } else if (currentStatus === CpWorkspaceStatus.ARCHIVED) {
      if (newStatus === CpWorkspaceStatus.ACTIVE) isValid = true;
    }

    if (!isValid) {
      throw new BadRequestException(`Invalid transition from ${currentStatus} to ${newStatus}`);
    }

    const now = new Date();
    const updateData: Record<string, unknown> = { status: newStatus };
    
    if (newStatus === CpWorkspaceStatus.SUSPENDED) {
      updateData.suspendedAt = now;
    } else if (newStatus === CpWorkspaceStatus.ARCHIVED) {
      updateData.archivedAt = now;
      updateData.deletedAt = now;
    } else if (newStatus === CpWorkspaceStatus.ACTIVE) {
      if (currentStatus === CpWorkspaceStatus.SUSPENDED) {
        updateData.suspendedAt = null;
      }
      if (currentStatus === CpWorkspaceStatus.ARCHIVED) {
        updateData.archivedAt = null;
        updateData.deletedAt = null;
      }
    }

    const updated = await this.db.cpWorkspace.update({
      where: { id: workspace.id },
      data: updateData,
    });

    this.notifications.send({
      recipientAuthId: ctx.authUserId,
      type: CpNotificationType.WORKSPACE_SUSPENDED,
      title: `Workspace ${dto.status.toLowerCase()}`,
      message: `Workspace "${workspace.name}" is now ${dto.status.toLowerCase()}`,
      workspaceId: workspace.id,
      organizationId: ctx.organizationId,
    });

    if (dto.status === CpWorkspaceStatus.SUSPENDED) {
      const org = await this.db.cpOrganization.findUnique({
        where: { id: workspace.organizationId },
        select: { creatorAuthId: true },
      });
      if (org) {
        this.notifications.send({
          recipientAuthId: org.creatorAuthId,
          type: CpNotificationType.ORG_ALERT,
          title: 'Action Required: Workspace Suspended',
          message: `Workspace "${workspace.name}" has been suspended in your organization.`,
          organizationId: ctx.organizationId,
        });
      }
    }

    this.auditLog.write({
      ctx,
      req,
      workspaceId: workspace.id,
      organizationId: ctx.organizationId,
      eventType: 'WORKSPACE_STATUS_CHANGED',
      targetEntity: 'CpWorkspace',
      targetEntityId: workspace.id,
      action: 'UPDATE',
      before: { status: workspace.status } as Record<string, unknown>,
      after: { status: dto.status } as Record<string, unknown>,
    });

    return updated;
  }

  async inviteAdmin(
    ctx: CpRequestContext,
    workspaceId: string,
    dto: InviteAdminDto,
    req: Request,
  ) {
    const workspace = await this.resolveWorkspace(ctx, workspaceId);

    // Find inviting member (creator may not be a workspace member)
    const inviterMember = await this.db.cpWorkspaceMember.findFirst({
      where: { workspaceId: workspace.id, authUserId: ctx.authUserId },
    });

    // Check for existing pending invite
    const existingInvite = await this.db.cpWorkspaceInvite.findFirst({
      where: {
        workspaceId: workspace.id,
        email: dto.email,
        status: 'PENDING',
      },
    });
    if (existingInvite) {
      throw new ConflictException(
        'A pending invite already exists for this email',
      );
    }

    // Generate and hash token
    const rawToken = randomBytes(32).toString('hex');
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');

    // Create invite — requires an invitedBy member (creator must be a member or we use a dummy)
    // If creator is not a workspace member, we auto-join them as CREATOR member
    let invitedByMemberId: string;
    if (inviterMember) {
      invitedByMemberId = inviterMember.id;
    } else {
      // Creator is not a member yet — create a CREATOR membership
      const creatorMember = await this.db.cpWorkspaceMember.create({
        data: {
          workspaceId: workspace.id,
          authUserId: ctx.authUserId,
          role: CpRole.CREATOR,
          status: 'ACTIVE',
        },
      });
      invitedByMemberId = creatorMember.id;
    }

    const invite = await this.db.cpWorkspaceInvite.create({
      data: {
        workspaceId: workspace.id,
        email: dto.email,
        role: CpRole.WORKSPACE_ADMIN,
        token: hashedToken,
        status: 'PENDING',
        invitedById: invitedByMemberId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const companyProfile = await this.db.cpCompanyProfile.findUnique({
      where: { workspaceId: workspace.id },
    });

    void this.isceAuth.sendAdminInvite({
      email: dto.email,
      token: rawToken,
      role: CpRole.WORKSPACE_ADMIN,
      workspaceName: companyProfile?.name ?? workspace.name,
      inviterName: ctx.authUserId,
    });

    this.auditLog.write({
      ctx,
      req,
      workspaceId: workspace.id,
      organizationId: ctx.organizationId,
      eventType: 'WORKSPACE_ADMIN_INVITED',
      targetEntity: 'CpWorkspaceInvite',
      targetEntityId: invite.id,
      action: 'SEND',
      after: { email: invite.email, role: invite.role } as Record<
        string,
        unknown
      >,
    });

    return { message: 'Invitation sent', inviteId: invite.id };
  }

  private async resolveWorkspace(ctx: CpRequestContext, workspaceId: string) {
    const where =
      ctx.role === CpRole.CREATOR
        ? {
            id: workspaceId,
            organizationId: ctx.organizationId,
          }
        : { id: workspaceId };

    const workspace = await this.db.cpWorkspace.findFirst({ where });
    if (!workspace) throw new NotFoundException('Workspace not found');

    // Non-CREATOR: verify workspace belongs to same org
    if (
      ctx.role !== CpRole.CREATOR &&
      workspace.organizationId !== ctx.organizationId
    ) {
      throw new ForbiddenException('Access denied');
    }

    return workspace;
  }

  private async generateWorkspaceSlug(name: string): Promise<string> {
    const base = toSlug(name);
    let slug = base || `ws-${randomBytes(2).toString('hex')}`;
    for (let attempt = 0; attempt < 6; attempt++) {
      const existing = await this.db.cpWorkspace.findUnique({
        where: { slug },
      });
      if (!existing) return slug;
      slug = toSlugWithSuffix(base || 'ws');
    }
    throw new ConflictException('Could not generate a unique slug');
  }

  async getMyWorkspaces(authUserId: string) {
    const orgsCreated = await this.db.cpOrganization.findMany({
      where: { creatorAuthId: authUserId },
      select: { id: true },
    });
    const orgIds = orgsCreated.map((o) => o.id);

    const memberships = await this.db.cpWorkspaceMember.findMany({
      where: {
        authUserId,
        status: { not: 'REMOVED' },
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            organizationId: true,
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const memberWorkspaceIds = new Set(memberships.map((m) => m.workspace.id));

    const result = memberships.map((m) => {
      const isOrgCreator = orgIds.includes(m.workspace.organizationId);
      return {
        memberId: m.id,
        role: isOrgCreator ? CpRole.CREATOR : m.role,
        status: m.status,
        joinedAt: m.joinedAt,
        workspace: m.workspace,
      };
    });

    if (orgIds.length > 0) {
      const extraWorkspaces = await this.db.cpWorkspace.findMany({
        where: {
          organizationId: { in: orgIds },
          id: { notIn: Array.from(memberWorkspaceIds) },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          organizationId: true,
          createdAt: true,
        },
      });

      for (const ws of extraWorkspaces) {
        result.push({
          memberId: `creator-${ws.id}`,
          role: CpRole.CREATOR,
          status: 'ACTIVE',
          joinedAt: ws.createdAt,
          workspace: ws,
        });
      }
    }

    return result;
  }
}
