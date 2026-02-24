import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { ThreadEventType } from './thread-event.service';
import { DatabaseService } from '../database/database.service';

interface JwtPayload {
  id: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  displayPicture?: string;
  userType?: string;
  iat?: number;
  exp?: number;
}

// ═══════════════════════════════════════════════════════════
// Thread WebSocket Gateway
// ═══════════════════════════════════════════════════════════

@WebSocketGateway({
  namespace: '/threads',
  cors: {
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3154'],
    credentials: true,
  },
})
export class ThreadGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ThreadGateway.name);

  constructor(private readonly db: DatabaseService) {}

  // ─── Connection lifecycle ───────────────────────────

  async handleConnection(client: Socket) {
    try {
      const user = this.authenticate(client);
      // Attach userId to socket for later use
      client.data.userId = user.id;
      this.logger.debug(`Client connected: ${client.id} (user: ${user.id})`);
    } catch {
      this.logger.warn(`Unauthorized connection attempt: ${client.id}`);
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  // ─── Join a thread room ─────────────────────────────

  @SubscribeMessage('join_thread')
  async handleJoinThread(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { threadId: string },
  ) {
    const userId = client.data.userId as string;
    if (!userId || !data?.threadId) {
      client.emit('error', { message: 'Invalid request' });
      return;
    }

    // Validate user is a participant of this thread
    const thread = await this.db.bookingThread.findUnique({
      where: { id: data.threadId },
      select: {
        clientUserId: true,
        artisan: { select: { userId: true } },
      },
    });

    if (!thread) {
      client.emit('error', { message: 'Thread not found' });
      return;
    }

    const isParticipant =
      thread.clientUserId === userId || thread.artisan?.userId === userId;

    if (!isParticipant) {
      client.emit('error', { message: 'Not a participant of this thread' });
      return;
    }

    const room = `thread:${data.threadId}`;
    await client.join(room);
    client.emit('joined_thread', { threadId: data.threadId });
    this.logger.debug(
      `User ${userId} joined room ${room} (socket: ${client.id})`,
    );
  }

  @SubscribeMessage('leave_thread')
  async handleLeaveThread(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { threadId: string },
  ) {
    if (!data?.threadId) return;
    const room = `thread:${data.threadId}`;
    await client.leave(room);
    this.logger.debug(`Socket ${client.id} left room ${room}`);
  }

  // ─── Emit to a thread room (called by ThreadEventService) ──

  emitToThread(
    threadId: string,
    type: ThreadEventType,
    payload: Record<string, unknown>,
  ) {
    const room = `thread:${threadId}`;
    this.server.to(room).emit(type, { type, ...payload });
  }

  // ─── Auth helper ────────────────────────────────────

  private authenticate(client: Socket): JwtPayload {
    const token =
      (client.handshake.auth?.token as string) ||
      (client.handshake.query?.token as string);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not set');
    }

    return jwt.verify(token, secret) as JwtPayload;
  }
}
