import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { CpRequestContext } from '../types/cp-request.types';
import { CpAuditLogService } from '../audit-logs/cp-audit-log.service';
import { CpNotificationsService } from '../notifications/notifications.service';
import { IsceAuthService } from '../isce-auth/isce-auth.service';
import {
  CpRole,
  CpNotificationType,
} from '../../generated/prisma/client';
import { CpSubscriptionsService } from '../subscriptions/subscriptions.service';
import { InviteStaffDto } from './dto/invite-staff.dto';
import { UpdateStaffProfileDto } from './dto/update-staff-profile.dto';
import { UpdateStaffStatusDto } from './dto/update-staff-status.dto';
import { UpdateStaffRoleDto } from './dto/update-staff-role.dto';
import { PaginateQueryDto } from '../common/dto/paginate-query.dto';
import { paginateResult } from '../utils/paginate';
import { Request } from 'express';

@Injectable()
export class CpStaffService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auditLog: CpAuditLogService,
    private readonly notifications: CpNotificationsService,
    private readonly isceAuth: IsceAuthService,
    private readonly subscriptions: CpSubscriptionsService,
  ) {}

  async inviteStaff(
    ctx: CpRequestContext,
    dto: InviteStaffDto,
    req: Request,
  ) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId) throw new ForbiddenException('Workspace context required');

    // Plan limit check
    const limitCheck = await this.subscriptions.checkLimit(
      ctx.organizationId,
      'staff',
      workspaceId,
    );
    if (!limitCheck.allowed) {
      throw new ForbiddenException(
        `Plan limit reached (${limitCheck.current}/${limitCheck.limit} staff). Upgrade your subscription.`,
      );
    }

    // Check for existing pending invite
    const existing = await this.db.cpWorkspaceInvite.findFirst({
      where: { workspaceId, email: dto.email, status: 'PENDING' },
    });
    if (existing) throw new ConflictException('Pending invite already exists for this email');

    // Resolve inviter member
    const inviterMember = await this.db.cpWorkspaceMember.findFirst({
      where: { workspaceId, authUserId: ctx.authUserId },
    });
    if (!inviterMember) throw new ForbiddenException('Inviter is not a workspace member');

    const rawToken = randomBytes(32).toString('hex');
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');

    const invite = await this.db.cpWorkspaceInvite.create({
      data: {
        workspaceId,
        email: dto.email,
        role: CpRole.STAFF,
        token: hashedToken,
        status: 'PENDING',
        invitedById: inviterMember.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const workspace = await this.db.cpWorkspace.findUnique({
      where: { id: workspaceId },
      include: { companyProfile: true },
    });

    void this.isceAuth.sendStaffInvite({
      email: dto.email,
      token: rawToken,
      role: CpRole.STAFF,
      workspaceName: workspace?.companyProfile?.name ?? workspace?.name ?? workspaceId,
      inviterName: ctx.authUserId,
      name: dto.name,
      jobTitle: dto.jobTitle,
    });

    this.auditLog.write({
      ctx,
      req,
      workspaceId,
      organizationId: ctx.organizationId,
      eventType: 'STAFF_INVITED',
      targetEntity: 'CpWorkspaceInvite',
      targetEntityId: invite.id,
      action: 'SEND',
      after: { email: invite.email, role: invite.role } as Record<string, unknown>,
    });

    return { message: 'Staff invitation sent', inviteId: invite.id };
  }

  async listInvites(ctx: CpRequestContext) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId) throw new ForbiddenException('Workspace context required');

    return this.db.cpWorkspaceInvite.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listStaff(ctx: CpRequestContext, query: PaginateQueryDto) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId) throw new ForbiddenException('Workspace context required');

    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [data, total] = await this.db.$transaction([
      this.db.cpStaffProfile.findMany({
        where: { workspaceId, deletedAt: null },
        include: { member: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.cpStaffProfile.count({ where: { workspaceId, deletedAt: null } }),
    ]);

    return paginateResult(data, total, page, limit);
  }

  async getStaff(ctx: CpRequestContext, staffId: string) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId) throw new ForbiddenException('Workspace context required');

    // STAFF can only access own profile
    if (ctx.role === CpRole.STAFF) {
      const ownProfile = await this.db.cpStaffProfile.findFirst({
        where: { workspaceId, memberId: ctx.memberId, deletedAt: null },
        include: { member: true },
      });
      if (!ownProfile || ownProfile.id !== staffId) {
        throw new ForbiddenException('Access denied');
      }
      return ownProfile;
    }

    const profile = await this.db.cpStaffProfile.findFirst({
      where: { id: staffId, workspaceId, deletedAt: null },
      include: { member: true },
    });
    if (!profile) throw new NotFoundException('Staff profile not found');
    return profile;
  }

  async updateStaff(
    ctx: CpRequestContext,
    staffId: string,
    dto: UpdateStaffProfileDto,
    req: Request,
  ) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId) throw new ForbiddenException('Workspace context required');

    const profile = await this.db.cpStaffProfile.findFirst({
      where: { id: staffId, workspaceId, deletedAt: null },
    });
    if (!profile) throw new NotFoundException('Staff profile not found');

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.jobTitle !== undefined) updateData.jobTitle = dto.jobTitle;
    if (dto.department !== undefined) updateData.department = dto.department;
    if (dto.bio !== undefined) updateData.bio = dto.bio;

    const updated = await this.db.cpStaffProfile.update({
      where: { id: staffId },
      data: updateData,
    });

    this.auditLog.write({
      ctx,
      req,
      workspaceId,
      organizationId: ctx.organizationId,
      eventType: 'STAFF_UPDATED',
      targetEntity: 'CpStaffProfile',
      targetEntityId: profile.id,
      action: 'UPDATE',
      before: profile as Record<string, unknown>,
      after: updated as Record<string, unknown>,
    });

    return updated;
  }

  async updateStaffStatus(
    ctx: CpRequestContext,
    staffId: string,
    dto: UpdateStaffStatusDto,
    req: Request,
  ) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId) throw new ForbiddenException('Workspace context required');

    const profile = await this.db.cpStaffProfile.findFirst({
      where: { id: staffId, workspaceId, deletedAt: null },
      include: { member: true },
    });
    if (!profile) throw new NotFoundException('Staff profile not found');

    const updateData: Record<string, unknown> = { status: dto.status };
    if (dto.status === 'REMOVED') {
      updateData.deletedAt = new Date();
    }

    await this.db.cpWorkspaceMember.update({
      where: { id: profile.memberId },
      data: updateData,
    });

    if (dto.status === 'REMOVED') {
      await this.db.cpStaffProfile.update({
        where: { id: staffId },
        data: { deletedAt: new Date() },
      });
    }

    this.auditLog.write({
      ctx,
      req,
      workspaceId,
      organizationId: ctx.organizationId,
      eventType: 'STAFF_STATUS_CHANGED',
      targetEntity: 'CpStaffProfile',
      targetEntityId: profile.id,
      action: 'UPDATE',
      before: { status: profile.member.status } as Record<string, unknown>,
      after: { status: dto.status } as Record<string, unknown>,
    });

    void this.notifications.send({
      recipientAuthId: profile.authUserId,
      type: dto.status === 'REMOVED' ? CpNotificationType.STAFF_REMOVED : CpNotificationType.STAFF_SUSPENDED,
      title: `Account ${dto.status.toLowerCase()}`,
      message: `Your account has been ${dto.status.toLowerCase()}`,
      workspaceId,
      organizationId: ctx.organizationId,
    });

    return { message: `Staff ${dto.status.toLowerCase()}` };
  }

  async updateStaffRole(
    ctx: CpRequestContext,
    staffId: string,
    dto: UpdateStaffRoleDto,
    req: Request,
  ) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId) throw new ForbiddenException('Workspace context required');

    const profile = await this.db.cpStaffProfile.findFirst({
      where: { id: staffId, workspaceId, deletedAt: null },
      include: { member: true },
    });
    if (!profile) throw new NotFoundException('Staff profile not found');

    const updated = await this.db.cpWorkspaceMember.update({
      where: { id: profile.memberId },
      data: { role: dto.role },
    });

    this.auditLog.write({
      ctx,
      req,
      workspaceId,
      organizationId: ctx.organizationId,
      eventType: 'STAFF_ROLE_CHANGED',
      targetEntity: 'CpWorkspaceMember',
      targetEntityId: profile.memberId,
      action: 'UPDATE',
      before: { role: profile.member.role } as Record<string, unknown>,
      after: { role: dto.role } as Record<string, unknown>,
    });

    return updated;
  }
}

