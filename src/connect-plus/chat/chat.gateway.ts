import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { DatabaseService } from '../../database/database.service';
import {
  CpMemberStatus,
  CpRole,
  CpSenderRole,
} from '../../generated/prisma/client';

interface JwtPayload {
  id: string;
  email?: string;
}

@WebSocketGateway({
  namespace: '/cp',
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? [],
    credentials: true,
  },
})
export class CpChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(CpChatGateway.name);

  /** authUserId → socketId */
  private readonly connectedUsers = new Map<string, string>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly db: DatabaseService,
  ) {}

  // ─── Connection ─────────────────────────────────────────────
  handleConnection(client: Socket): void {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) throw new Error('No token');
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
      client.data.authUserId = payload.id;
      this.connectedUsers.set(payload.id, client.id);
      this.logger.debug(
        `CP socket connected: ${client.id} (user: ${payload.id})`,
      );
    } catch {
      client.emit('cp:error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const authUserId = client.data.authUserId as string | undefined;
    if (authUserId) this.connectedUsers.delete(authUserId);
    this.logger.debug(`CP socket disconnected: ${client.id}`);
  }

  // ─── Join workspace ──────────────────────────────────────────
  @SubscribeMessage('cp:join-workspace')
  async handleJoinWorkspace(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { workspaceId: string },
  ): Promise<void> {
    const authUserId = client.data.authUserId as string | undefined;
    if (!authUserId) {
      client.emit('cp:error', { message: 'Unauthorized' });
      return;
    }

    const { workspaceId } = payload;

    const member = await this.db.cpWorkspaceMember.findUnique({
      where: { workspaceId_authUserId: { workspaceId, authUserId } },
      include: { workspace: { select: { name: true, slug: true } } },
    });

    if (!member || member.status !== CpMemberStatus.ACTIVE) {
      client.emit('cp:error', { message: 'Not a member of this workspace' });
      return;
    }

    client.data.workspaceId = workspaceId;
    void client.join(`workspace:${workspaceId}`);

    // Join all relevant conversation rooms
    const participations = await this.db.cpConversationParticipant.findMany({
      where: { authUserId, leftAt: null, conversation: { workspaceId } },
      select: { conversationId: true },
    });
    for (const p of participations) {
      void client.join(`conversation:${p.conversationId}`);
    }

    client.emit('cp:workspace-joined', {
      workspaceId,
      name: member.workspace.name,
      slug: member.workspace.slug,
    });
  }

  // ─── Send message ────────────────────────────────────────────
  @SubscribeMessage('cp:message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      conversationId: string;
      content: string;
      attachments?: Array<{
        url: string;
        name: string;
        type: string;
        size: number;
      }>;
    },
  ): Promise<void> {
    try {
      const authUserId = client.data.authUserId as string | undefined;
      const workspaceId = client.data.workspaceId as string | undefined;
      if (!authUserId || !workspaceId) {
        client.emit('cp:error', { message: 'Not joined to a workspace' });
        return;
      }

      const conversation = await this.db.cpConversation.findFirst({
        where: { id: payload.conversationId, workspaceId },
      });
      if (!conversation) {
        client.emit('cp:error', { message: 'Conversation not found' });
        return;
      }

      const participant = await this.db.cpConversationParticipant.findUnique({
        where: {
          conversationId_authUserId: {
            conversationId: payload.conversationId,
            authUserId,
          },
        },
      });
      if (!participant || participant.leftAt) {
        client.emit('cp:error', {
          message: 'Not a participant in this conversation',
        });
        return;
      }

      // Determine sender role
      const member = await this.db.cpWorkspaceMember.findUnique({
        where: { workspaceId_authUserId: { workspaceId, authUserId } },
      });
      const senderRole =
        member?.role === CpRole.CLIENT
          ? CpSenderRole.CLIENT
          : CpSenderRole.STAFF;

      const message = await this.db.cpMessage.create({
        data: {
          conversationId: payload.conversationId,
          senderId: authUserId,
          senderRole,
          content: payload.content,
          attachments: payload.attachments
            ? (payload.attachments as unknown as import('../../generated/prisma/client').Prisma.InputJsonValue)
            : undefined,
          isSystem: false,
        },
      });

      await this.db.cpConversation.update({
        where: { id: payload.conversationId },
        data: { lastMessageAt: new Date() },
      });

      this.server
        .to(`conversation:${payload.conversationId}`)
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
    } catch (err) {
      this.logger.error('cp:message error', err);
      client.emit('cp:error', { message: 'Failed to send message' });
    }
  }

  // ─── Typing indicator ────────────────────────────────────────
  @SubscribeMessage('cp:typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ): Promise<void> {
    const authUserId = client.data.authUserId as string | undefined;
    if (!authUserId) return;

    const participant = await this.db.cpConversationParticipant.findUnique({
      where: {
        conversationId_authUserId: {
          conversationId: payload.conversationId,
          authUserId,
        },
      },
    });
    if (!participant || participant.leftAt) return;

    client.to(`conversation:${payload.conversationId}`).emit('cp:typing', {
      conversationId: payload.conversationId,
      authUserId,
    });
  }

  // ─── Leave workspace ─────────────────────────────────────────
  @SubscribeMessage('cp:leave-workspace')
  handleLeaveWorkspace(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { workspaceId: string },
  ): void {
    void client.leave(`workspace:${payload.workspaceId}`);
    client.data.workspaceId = undefined;
  }

  // ─── Emit helpers (called by NotificationService) ────────────
  emitToWorkspace(workspaceId: string, event: string, data: unknown): void {
    this.server.to(`workspace:${workspaceId}`).emit(event, data);
  }

  emitToUser(authUserId: string, event: string, data: unknown): void {
    const socketId = this.connectedUsers.get(authUserId);
    if (socketId) this.server.to(socketId).emit(event, data);
  }
}
