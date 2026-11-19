import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CpRequestContext } from '../types/cp-request.types';
import { CpAuditLogService } from '../audit-logs/cp-audit-log.service';
import { CpNotificationsService } from '../notifications/notifications.service';
import {
  CpRole,
  CpMemberStatus,
  CpNotificationType,
  Prisma,
} from '../../generated/prisma/client';
import { CpSubscriptionsService } from '../subscriptions/subscriptions.service';
import { CpInvitesService } from '../invites/invites.service';
import { InviteStaffDto } from './dto/invite-staff.dto';
import { UpdateStaffProfileDto } from './dto/update-staff-profile.dto';
import { UpdateStaffStatusDto } from './dto/update-staff-status.dto';
import { UpdateStaffRoleDto } from './dto/update-staff-role.dto';
import { ListStaffQueryDto } from './dto/list-staff-query.dto';
import { paginateResult } from '../utils/paginate';
import { Request } from 'express';

@Injectable()
export class CpStaffService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auditLog: CpAuditLogService,
    private readonly notifications: CpNotificationsService,
    private readonly subscriptions: CpSubscriptionsService,
    private readonly invites: CpInvitesService,
  ) {}

  async inviteStaff(ctx: CpRequestContext, dto: InviteStaffDto, req: Request) {
    return this.invites.sendInvite(ctx, dto, req);
  }

  async listInvites(ctx: CpRequestContext) {
    return this.invites.listInvites(ctx);
  }

  async listStaff(ctx: CpRequestContext, query: ListStaffQueryDto) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId)
      throw new ForbiddenException('Workspace context required');

    const { page = 1, limit = 20, search, status } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CpStaffProfileWhereInput = {
      workspaceId,
      deletedAt: null,
    };
    if (status) where.member = { status };
    const term = search?.trim();
    if (term) {
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { jobTitle: { contains: term, mode: 'insensitive' } },
        { department: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await this.db.$transaction([
      this.db.cpStaffProfile.findMany({
        where,
        include: { member: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.cpStaffProfile.count({ where }),
    ]);

    return paginateResult(data, total, page, limit);
  }

  async getStaff(ctx: CpRequestContext, staffId: string) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId)
      throw new ForbiddenException('Workspace context required');

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
    if (!workspaceId)
      throw new ForbiddenException('Workspace context required');

    const profile = await this.db.cpStaffProfile.findFirst({
      where: { id: staffId, workspaceId, deletedAt: null },
    });
    if (!profile) throw new NotFoundException('Staff profile not found');

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.jobTitle !== undefined) updateData.jobTitle = dto.jobTitle;
    if (dto.department !== undefined) updateData.department = dto.department;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
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

  /**
   * Blocks actions that would lock a workspace out of management: acting on
   * yourself, touching the owner, or removing the last active admin.
   */
  private async assertCanChangeMember(
    ctx: CpRequestContext,
    workspaceId: string,
    profile: { authUserId: string; memberId: string; member: { role: CpRole } },
    losesAdmin: boolean,
  ) {
    if (profile.authUserId === ctx.authUserId) {
      throw new ForbiddenException('You cannot change your own role or status');
    }
    if (profile.member.role === CpRole.CREATOR) {
      throw new ForbiddenException('The workspace owner cannot be changed');
    }
    if (losesAdmin && profile.member.role === CpRole.WORKSPACE_ADMIN) {
      const otherAdmins = await this.db.cpWorkspaceMember.count({
        where: {
          workspaceId,
          id: { not: profile.memberId },
          status: CpMemberStatus.ACTIVE,
          role: { in: [CpRole.WORKSPACE_ADMIN, CpRole.CREATOR] },
        },
      });
      if (otherAdmins === 0) {
        throw new ForbiddenException(
          'At least one active admin is required in the workspace',
        );
      }
    }
  }

  async updateStaffStatus(
    ctx: CpRequestContext,
    staffId: string,
    dto: UpdateStaffStatusDto,
    req: Request,
  ) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId)
      throw new ForbiddenException('Workspace context required');

    const profile = await this.db.cpStaffProfile.findFirst({
      where: { id: staffId, workspaceId, deletedAt: null },
      include: { member: true },
    });
    if (!profile) throw new NotFoundException('Staff profile not found');

    await this.assertCanChangeMember(
      ctx,
      workspaceId,
      profile,
      dto.status !== CpMemberStatus.ACTIVE,
    );

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
      type:
        dto.status === 'REMOVED'
          ? CpNotificationType.STAFF_REMOVED
          : CpNotificationType.STAFF_SUSPENDED,
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
    if (!workspaceId)
      throw new ForbiddenException('Workspace context required');

    if (dto.role === CpRole.CREATOR) {
      throw new ForbiddenException('Cannot set role to CREATOR');
    }

    const profile = await this.db.cpStaffProfile.findFirst({
      where: { id: staffId, workspaceId, deletedAt: null },
      include: { member: true },
    });
    if (!profile) throw new NotFoundException('Staff profile not found');

    await this.assertCanChangeMember(
      ctx,
      workspaceId,
      profile,
      dto.role !== CpRole.WORKSPACE_ADMIN,
    );

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
