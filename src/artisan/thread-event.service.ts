import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Subject, Observable, filter, map } from 'rxjs';

// ─── Event types emitted over SSE ──────────────────────

export type ThreadEventType =
  | 'new_message'
  | 'status_changed'
  | 'payment_update'
  | 'thread_closed';

export interface ThreadEvent {
  threadId: string;
  type: ThreadEventType;
  data: Record<string, unknown>;
}

// ─── Service ────────────────────────────────────────────

@Injectable()
export class ThreadEventService {
  private readonly stream$ = new Subject<ThreadEvent>();

  constructor(private readonly eventEmitter: EventEmitter2) {
    // Bridge NestJS EventEmitter → RxJS Subject
    this.eventEmitter.on('thread.*', (event: ThreadEvent) => {
      this.stream$.next(event);
    });
  }

  /**
   * Emit a thread event (called from ThreadService after mutations).
   */
  emit(type: ThreadEventType, threadId: string, data: Record<string, unknown>) {
    const event: ThreadEvent = { threadId, type, data };
    this.eventEmitter.emit(`thread.${type}`, event);
  }

  /**
   * Subscribe to SSE events for a specific thread.
   * Returns an Observable of MessageEvent (the shape NestJS @Sse expects).
   */
  subscribe(threadId: string): Observable<MessageEvent> {
    return this.stream$.pipe(
      filter((event) => event.threadId === threadId),
      map(
        (event) =>
          ({
            data: JSON.stringify({ type: event.type, ...event.data }),
          }) as MessageEvent,
      ),
    );
  }
}
