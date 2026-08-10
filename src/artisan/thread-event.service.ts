import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { ThreadGateway } from './thread.gateway';

// ─── Event types emitted over WebSocket ─────────────────

export type ThreadEventType =
  'new_message' | 'status_changed' | 'payment_update' | 'thread_closed';

export interface ThreadEvent {
  threadId: string;
  type: ThreadEventType;
  data: Record<string, unknown>;
}

// ─── Service ────────────────────────────────────────────

@Injectable()
export class ThreadEventService {
  constructor(
    @Inject(forwardRef(() => ThreadGateway))
    private readonly gateway: ThreadGateway,
  ) {}

  /**
   * Emit a thread event via WebSocket to all participants
   * in the thread room.
   */
  emit(type: ThreadEventType, threadId: string, data: Record<string, unknown>) {
    this.gateway.emitToThread(threadId, type, data);
  }
}
