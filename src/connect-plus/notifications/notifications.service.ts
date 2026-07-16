import {
  Injectable,
  Logger,
  Optional,
  Inject,
  forwardRef,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CpAuditLogService } from '../audit-logs/cp-audit-log.service';
import {
  CpNotificationType,
  CpRole,
  Prisma,
} from '../../generated/prisma/client';
import { CpRequestContext } from '../types/cp-request.types';
import { CpChatGateway } from '../chat/chat.gateway';
import { MailClientService } from '../../mail/mail-client.service';
import { PushService } from '../../push/push.service';

export interface SendNotificationParams {
  recipientAuthId: string;
  type: CpNotificationType;
  title: string;
  message: string;
  workspaceId?: string;
  organizationId?: string;
  metadata?: Prisma.InputJsonValue;
}

const EMAIL_TYPES = new Set<CpNotificationType>([
  CpNotificationType.APPOINTMENT_BOOKED,
  CpNotificationType.APPOINTMENT_CONFIRMED,
  CpNotificationType.APPOINTMENT_RESCHEDULED,
  CpNotificationType.APPOINTMENT_CANCELLED,
  CpNotificationType.CLIENT_INVITED,
  CpNotificationType.INVOICE_ISSUED,
  CpNotificationType.INVOICE_OVERDUE,
  CpNotificationType.INVOICE_PAID,
  CpNotificationType.WORKSPACE_INVITE_SENT,
  CpNotificationType.WORKSPACE_INVITE_ACCEPTED,
  CpNotificationType.STAFF_SUSPENDED,
  CpNotificationType.STAFF_REMOVED,
]);

@Injectable()
export class CpNotificationsService {
  private readonly logger = new Logger(CpNotificationsService.name);

  constructor(
    private readonly db: DatabaseService,
    @Optional()
    @Inject(forwardRef(() => CpChatGateway))
    private readonly chatGateway: CpChatGateway | null,
    @Optional() private readonly mailClient: MailClientService | null,
    @Optional() private readonly pushService: PushService | null,
    private readonly auditLog: CpAuditLogService,
  ) {}

  send(params: SendNotificationParams): void {
    // 1. Persist
    this.db.cpNotification
      .create({
        data: {
          recipientAuthId: params.recipientAuthId,
          type: params.type,
          title: params.title,
          message: params.message,
          workspaceId: params.workspaceId ?? null,
          organizationId: params.organizationId ?? null,
          metadata: params.metadata ?? null,
        },
      })
      .then((notification) => {
        // 2. Real-time in-app via gateway
        if (this.chatGateway) {
          this.chatGateway.emitToUser(
            params.recipientAuthId,
            'cp:notification',
            {
              id: notification.id,
              type: params.type,
              title: params.title,
              message: params.message,
            },
          );
        }
        // 3. Async delivery (fire-and-forget)
        this.deliver(params).catch((err: unknown) =>
          this.logger.error('notification delivery failed', err),
        );

        // 4. Audit Log
        this.auditLog.write({
          ctx: null,
          workspaceId: params.workspaceId,
          organizationId: params.organizationId,
          eventType: 'NOTIFICATION_SEND',
          targetEntity: 'CpNotification',
          targetEntityId: notification.id,
          action: 'CREATE',
          success: true,
        });
      })
      .catch((err: unknown) => {
        this.logger.error(
          `Failed to persist notification for ${params.recipientAuthId}: ${(err as Error).message}`,
        );
      });
  }

  private async deliver(params: SendNotificationParams): Promise<void> {
    const { recipientAuthId, type, title, message, workspaceId } = params;
    const recipient = await this.resolveRecipient(recipientAuthId, workspaceId);
    if (!recipient) return;

    const { email, role, fcmToken } = recipient;

    // Email — actionable types only
    if (email && EMAIL_TYPES.has(type) && this.mailClient) {
      await this.mailClient
        .sendEmail({
          to: email,
          subject: title,
          html: `<p>${message}</p>`,
          text: message,
        })
        .catch((err: unknown) =>
          this.logger.warn('email delivery failed', err),
        );
    }

    // FCM Push — STAFF and WORKSPACE_ADMIN only
    if (
      fcmToken &&
      (role === CpRole.STAFF || role === CpRole.WORKSPACE_ADMIN) &&
      this.pushService
    ) {
      await this.pushService
        .sendToUser(recipientAuthId, title, message)
        .catch((err: unknown) => this.logger.warn('push delivery failed', err));
    }
  }

  private async resolveRecipient(
    authUserId: string,
    workspaceId?: string,
  ): Promise<{
    email: string | null;
    role: CpRole;
    fcmToken: string | null;
  } | null> {
    // Try staff profile first
    const staff = await this.db.cpStaffProfile.findFirst({
      where: {
        authUserId,
        ...(workspaceId ? { workspaceId } : {}),
        deletedAt: null,
      },
      include: { member: { select: { role: true } } },
    });

    if (staff) {
      const fcmToken = await this.resolveFcmToken(authUserId);
      return {
        email: staff.email ?? null,
        role: staff.member.role as CpRole,
        fcmToken,
      };
    }

    // Try client record
    const client = await this.db.cpClient.findFirst({
      where: {
        authUserId,
        ...(workspaceId ? { workspaceId } : {}),
        deletedAt: null,
      },
    });
    if (client) {
      return {
        email: client.email ?? null,
        role: CpRole.CLIENT,
        fcmToken: null,
      };
    }

    return null;
  }

  // ─── REST query methods ─────────────────────────────────────

  async list(ctx: CpRequestContext) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId)
      throw new ForbiddenException('Workspace context required');

    return this.db.cpNotification.findMany({
      where: { recipientAuthId: ctx.authUserId, workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(ctx: CpRequestContext, id: string) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId)
      throw new ForbiddenException('Workspace context required');

    const notification = await this.db.cpNotification.findFirst({
      where: { id, recipientAuthId: ctx.authUserId, workspaceId },
    });
    if (!notification) throw new NotFoundException('Notification not found');

    await this.db.cpNotification.update({
      where: { id },
      data: { isRead: true },
    });

    return { ok: true };
  }

  async markAllRead(ctx: CpRequestContext) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId)
      throw new ForbiddenException('Workspace context required');

    await this.db.cpNotification.updateMany({
      where: { recipientAuthId: ctx.authUserId, workspaceId, isRead: false },
      data: { isRead: true },
    });

    return { ok: true };
  }

  private async resolveFcmToken(authUserId: string): Promise<string | null> {
    const profile = await this.db.profile.findFirst({
      where: { userId: authUserId },
      include: {
        deviceProfiles: {
          where: { fcmToken: { not: null } },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
    });
    return profile?.deviceProfiles?.[0]?.fcmToken ?? null;
  }
}
