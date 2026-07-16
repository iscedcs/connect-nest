import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CpNotificationsService } from '../notifications/notifications.service';
import { CpAuditLogService } from '../audit-logs/cp-audit-log.service';
import { CpRequestContext } from '../types/cp-request.types';
import {
  CpConversationType,
  CpMemberStatus,
  CpRole,
  CpSenderRole,
  Prisma,
  CpNotificationType,
} from '../../generated/prisma/client';
import { CreateDirectConversationDto } from './dto/create-direct-conversation.dto';
import { GetMessagesQueryDto } from './dto/get-messages-query.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { CpChatGateway } from './chat.gateway';

@Injectable()
export class CpChatService {
  constructor(
    private readonly db: DatabaseService,
    @Optional() private readonly gateway: CpChatGateway | null,
    @Inject(forwardRef(() => CpNotificationsService))
    private readonly notifications: CpNotificationsService,
    private readonly auditLog: CpAuditLogService,
  ) {}

  // ─── List my conversations ─────────────────────────────────────
  async listConversations(ctx: CpRequestContext) {
    const workspaceId = ctx.workspaceId!;
    const authUserId = ctx.authUserId;

    // Find conversations where user is a participant
    const participations = await this.db.cpConversationParticipant.findMany({
      where: { authUserId, leftAt: null },
      include: {
        conversation: {
          include: {
            participants: {
              where: { leftAt: null },
              select: { authUserId: true, lastReadAt: true },
            },
            messages: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    // Filter by workspace
    const inWorkspace = participations.filter(
      (p) =>
        p.conversation.workspaceId === workspaceId && !p.conversation.deletedAt,
    );

    return inWorkspace
      .sort((a, b) => {
        const aTime =
          a.conversation.lastMessageAt?.getTime() ??
          a.conversation.createdAt.getTime();
        const bTime =
          b.conversation.lastMessageAt?.getTime() ??
          b.conversation.createdAt.getTime();
        return bTime - aTime;
      })
      .map((p) => {
        const conv = p.conversation;
        const lastMsg = conv.messages[0] ?? null;
        const myParticipant = p;
        const unreadCount = myParticipant.lastReadAt
          ? conv.messages.filter((m) => m.createdAt > myParticipant.lastReadAt!)
              .length
          : conv.messages.length;

        return {
          id: conv.id,
          type: conv.type,
          name: conv.name,
          workspaceId: conv.workspaceId,
          lastMessageAt: conv.lastMessageAt,
          lastMessage: lastMsg
            ? {
                content: lastMsg.content,
                createdAt: lastMsg.createdAt,
                senderRole: lastMsg.senderRole,
              }
            : null,
          unreadCount,
        };
      });
  }

  // ─── Create direct conversation ────────────────────────────────
  async createDirect(ctx: CpRequestContext, dto: CreateDirectConversationDto) {
    const workspaceId = ctx.workspaceId!;
    const authUserId = ctx.authUserId;

    // Validate target is active member of this workspace
    const targetMember = await this.db.cpWorkspaceMember.findUnique({
      where: {
        workspaceId_authUserId: {
          workspaceId,
          authUserId: dto.targetAuthUserId,
        },
      },
    });
    if (!targetMember || targetMember.status !== CpMemberStatus.ACTIVE) {
      throw new NotFoundException(
        'Target user is not an active member of this workspace',
      );
    }

    // Check for existing DIRECT conversation between these two users in this workspace
    const existing = await this.db.cpConversation.findFirst({
      where: {
        workspaceId,
        type: CpConversationType.DIRECT,
        deletedAt: null,
        participants: {
          some: { authUserId },
        },
      },
      include: { participants: true },
    });

    if (existing) {
      const hasTarget = existing.participants.some(
        (p) => p.authUserId === dto.targetAuthUserId,
      );
      if (hasTarget) return existing;
    }

    // Create new direct conversation
    const conversation = await this.db.cpConversation.create({
      data: {
        workspaceId,
        type: CpConversationType.DIRECT,
        participants: {
          create: [{ authUserId }, { authUserId: dto.targetAuthUserId }],
        },
      },
      include: { participants: true },
    });

    this.auditLog.write({
      ctx,
      eventType: 'CHAT_CONVERSATION_CREATE',
      targetEntity: 'CpConversation',
      targetEntityId: conversation.id,
      action: 'CREATE',
      success: true,
    });

    return conversation;
  }

  // ─── Get messages (cursor pagination) ─────────────────────────
  async getMessages(
    ctx: CpRequestContext,
    convId: string,
    query: GetMessagesQueryDto,
  ) {
    const workspaceId = ctx.workspaceId!;
    const authUserId = ctx.authUserId;

    const conversation = await this.db.cpConversation.findFirst({
      where: { id: convId, workspaceId, deletedAt: null },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    // Validate user is an active participant
    const participant = await this.db.cpConversationParticipant.findUnique({
      where: {
        conversationId_authUserId: { conversationId: convId, authUserId },
      },
    });
    if (!participant || participant.leftAt) {
      throw new ForbiddenException('Not a participant in this conversation');
    }

    const limit = Math.min(50, Math.max(1, parseInt(query.limit ?? '30', 10)));
    const before = query.before ? new Date(query.before) : undefined;

    const messages = await this.db.cpMessage.findMany({
      where: {
        conversationId: convId,
        ...(before ? { createdAt: { lt: before } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Replace content of soft-deleted messages for display
    return messages.map((m) =>
      m.deletedAt ? { ...m, content: '[Message deleted]' } : m,
    );
  }
  // ─── Send message (HTTP) ────────────────────────────────────────
  async sendMessage(
    ctx: CpRequestContext,
    convId: string,
    dto: SendMessageDto,
  ) {
    const workspaceId = ctx.workspaceId!;
    const authUserId = ctx.authUserId;

    const conversation = await this.db.cpConversation.findFirst({
      where: { id: convId, workspaceId, deletedAt: null },
      include: { participants: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const participant = await this.db.cpConversationParticipant.findUnique({
      where: {
        conversationId_authUserId: { conversationId: convId, authUserId },
      },
    });
    if (!participant || participant.leftAt) {
      throw new ForbiddenException('Not a participant in this conversation');
    }

    const member = await this.db.cpWorkspaceMember.findUnique({
      where: { workspaceId_authUserId: { workspaceId, authUserId } },
      include: {
        staffProfile: { select: { name: true } },
        clientRecord: { select: { name: true } },
      },
    });
    const senderRole =
      member?.role === CpRole.CLIENT ? CpSenderRole.CLIENT : CpSenderRole.STAFF;
    const senderName = member?.staffProfile?.name ?? member?.clientRecord?.name ?? 'Someone';

    const message = await this.db.cpMessage.create({
      data: {
        conversationId: convId,
        senderId: authUserId,
        senderRole,
        content: dto.content,
        attachments: dto.attachments
          ? (dto.attachments as unknown as Prisma.InputJsonValue)
          : undefined,
        isSystem: false,
      },
    });

    await this.db.cpConversation.update({
      where: { id: convId },
      data: { lastMessageAt: new Date() },
    });

    if (this.gateway) {
      this.gateway.server
        .to(`conversation:${convId}`)
        .emit('cp:message-received', {
          message: {
            id: message.id,
            conversationId: message.conversationId,
            senderId: message.senderId,
            senderRole: message.senderRole,
            content: message.content,
            attachments: message.attachments,
            createdAt: message.createdAt,
          },
        });
    }

    const offlineParticipants = conversation.participants.filter((p) => {
      if (p.authUserId === authUserId) return false;
      if (this.gateway && this.gateway.isUserOnline(p.authUserId)) return false;
      return true;
    });

    const notifType = senderRole === CpSenderRole.CLIENT ? CpNotificationType.CLIENT_MESSAGE : CpNotificationType.NEW_MESSAGE;
    
    for (const p of offlineParticipants) {
      void this.notifications.send({
        recipientAuthId: p.authUserId,
        type: notifType,
        title: `New Message from ${senderName}`,
        message: dto.content,
        workspaceId,
        organizationId: ctx.organizationId,
        metadata: { conversationId: convId, messageId: message.id },
      });
    }

    this.auditLog.write({
      ctx,
      eventType: 'CHAT_MESSAGE_SEND',
      targetEntity: 'CpMessage',
      targetEntityId: message.id,
      action: 'CREATE',
      success: true,
    });

    return message;
  }
  // ─── Mark conversation as read ─────────────────────────────────
  async markRead(ctx: CpRequestContext, convId: string) {
    const workspaceId = ctx.workspaceId!;
    const authUserId = ctx.authUserId;

    const conversation = await this.db.cpConversation.findFirst({
      where: { id: convId, workspaceId, deletedAt: null },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const participant = await this.db.cpConversationParticipant.findUnique({
      where: {
        conversationId_authUserId: { conversationId: convId, authUserId },
      },
    });
    if (!participant || participant.leftAt) {
      throw new ForbiddenException('Not a participant in this conversation');
    }

    await this.db.cpConversationParticipant.update({
      where: {
        conversationId_authUserId: { conversationId: convId, authUserId },
      },
      data: { lastReadAt: new Date() },
    });

    this.auditLog.write({
      ctx,
      eventType: 'CHAT_CONVERSATION_READ',
      targetEntity: 'CpConversationParticipant',
      targetEntityId: participant.id,
      action: 'UPDATE',
      success: true,
    });

    return { ok: true };
  }
}
