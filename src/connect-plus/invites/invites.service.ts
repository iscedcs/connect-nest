import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { CpAuditLogService } from '../audit-logs/cp-audit-log.service';
import { IsceAuthService } from '../isce-auth/isce-auth.service';
import { CpSubscriptionsService } from '../subscriptions/subscriptions.service';
import { CpRole, CpNotificationType } from '../../generated/prisma/client';
import { CpRequestContext } from '../types/cp-request.types';
import { CpNotificationsService } from '../notifications/notifications.service';
import { SendInviteDto } from './dto/send-invite.dto';
import { Request } from 'express';

@Injectable()
export class CpInvitesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auditLog: CpAuditLogService,
    private readonly isceAuth: IsceAuthService,
    private readonly subscriptions: CpSubscriptionsService,
    private readonly notifications: CpNotificationsService,
  ) {}

  async sendInvite(ctx: CpRequestContext, dto: SendInviteDto, req: Request) {
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

    // Prevent duplicate pending invites for the same email
    const existing = await this.db.cpWorkspaceInvite.findFirst({
      where: { workspaceId, email: dto.email, status: 'PENDING' },
    });
    if (existing) {
      throw new ConflictException('A pending invite already exists for this email');
    }

    // Resolve the inviter's workspace member record
    const inviterMember = await this.db.cpWorkspaceMember.findFirst({
      where: { workspaceId, authUserId: ctx.authUserId },
    });
    if (!inviterMember) throw new ForbiddenException('Inviter is not a workspace member');

    const rawToken = randomBytes(32).toString('hex');
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invite = await this.db.cpWorkspaceInvite.create({
      data: {
        workspaceId,
        email: dto.email,
        role: CpRole.STAFF,
        token: hashedToken,
        status: 'PENDING',
        invitedById: inviterMember.id,
        expiresAt,
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
      workspaceId,
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

    this.notifications.send({
      recipientAuthId: ctx.authUserId,
      type: CpNotificationType.WORKSPACE_INVITE_SENT,
      title: 'Staff Invite Sent',
      message: `You invited ${dto.email} as ${invite.role}.`,
      workspaceId,
      organizationId: ctx.organizationId,
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

  async getInvite(ctx: CpRequestContext, inviteId: string) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId) throw new ForbiddenException('Workspace context required');

    const invite = await this.db.cpWorkspaceInvite.findFirst({
      where: { id: inviteId, workspaceId },
    });
    if (!invite) throw new NotFoundException('Invite not found');

    return invite;
  }

  async resendInvite(ctx: CpRequestContext, inviteId: string, req: Request) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId) throw new ForbiddenException('Workspace context required');

    const invite = await this.db.cpWorkspaceInvite.findFirst({
      where: { id: inviteId, workspaceId },
    });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.status === 'ACCEPTED') {
      throw new BadRequestException('Invite has already been accepted');
    }
    if (invite.status === 'REVOKED') {
      throw new BadRequestException('Cannot resend a revoked invite');
    }

    // Regenerate token and extend expiry
    const rawToken = randomBytes(32).toString('hex');
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.db.cpWorkspaceInvite.update({
      where: { id: inviteId },
      data: { token: hashedToken, status: 'PENDING', expiresAt },
    });

    const workspace = await this.db.cpWorkspace.findUnique({
      where: { id: workspaceId },
      include: { companyProfile: true },
    });

    void this.isceAuth.sendStaffInvite({
      email: invite.email,
      token: rawToken,
      role: invite.role,
      workspaceId,
      workspaceName: workspace?.companyProfile?.name ?? workspace?.name ?? workspaceId,
      inviterName: ctx.authUserId,
    });

    this.auditLog.write({
      ctx,
      req,
      workspaceId,
      organizationId: ctx.organizationId,
      eventType: 'STAFF_INVITE_RESENT',
      targetEntity: 'CpWorkspaceInvite',
      targetEntityId: invite.id,
      action: 'RESEND',
      after: { email: invite.email, expiresAt } as Record<string, unknown>,
    });

    return { message: 'Invite resent', inviteId: invite.id };
  }

  async revokeInvite(ctx: CpRequestContext, inviteId: string, req: Request) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId) throw new ForbiddenException('Workspace context required');

    const invite = await this.db.cpWorkspaceInvite.findFirst({
      where: { id: inviteId, workspaceId },
    });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.status !== 'PENDING') {
      throw new BadRequestException(`Cannot revoke an invite with status: ${invite.status}`);
    }

    await this.db.cpWorkspaceInvite.update({
      where: { id: inviteId },
      data: { status: 'REVOKED' },
    });

    this.auditLog.write({
      ctx,
      req,
      workspaceId,
      organizationId: ctx.organizationId,
      eventType: 'STAFF_INVITE_REVOKED',
      targetEntity: 'CpWorkspaceInvite',
      targetEntityId: invite.id,
      action: 'DELETE',
      before: { status: 'PENDING' } as Record<string, unknown>,
      after: { status: 'REVOKED' } as Record<string, unknown>,
    });

    return { message: 'Invite revoked' };
  }
}

