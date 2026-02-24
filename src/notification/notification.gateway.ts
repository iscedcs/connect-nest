import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';

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
// Notification WebSocket Gateway
//
// Every authenticated user auto-joins their own room `user:{userId}`
// on connection. The backend emits `new_notification` and
// `unread_count` events to the user's room.
// ═══════════════════════════════════════════════════════════

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3154'],
    credentials: true,
  },
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  // ─── Connection lifecycle ───────────────────────────

  async handleConnection(client: Socket) {
    try {
      const user = this.authenticate(client);
      client.data.userId = user.id;

      // Auto-join user's personal room
      const room = `user:${user.id}`;
      await client.join(room);

      this.logger.debug(
        `Client connected: ${client.id} (user: ${user.id}) → room ${room}`,
      );
    } catch {
      this.logger.warn(`Unauthorized notification connection: ${client.id}`);
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Notification client disconnected: ${client.id}`);
  }

  // ─── Emit helpers (called by NotificationDispatcher) ────

  /**
   * Push a new notification object to a specific user.
   */
  emitNewNotification(userId: string, notification: Record<string, unknown>) {
    const room = `user:${userId}`;
    this.server.to(room).emit('new_notification', notification);
  }

  /**
   * Push updated unread count to a specific user.
   */
  emitUnreadCount(userId: string, count: number) {
    const room = `user:${userId}`;
    this.server.to(room).emit('unread_count', { count });
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
