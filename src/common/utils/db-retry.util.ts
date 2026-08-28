import { Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

const TRANSIENT_CODES = new Set([
  'P1001', // Can't reach database server
  'P1002', // Database server connection timeout
  'P1008', // Operations timed out
  'P1017', // Server has closed the connection
]);

const TRANSIENT_MESSAGES = [
  'ConnectionClosed',
  'ENETUNREACH',
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EPIPE',
  'connection terminated',
  '57P01', // terminating connection due to administrator command
];

function isTransientError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (TRANSIENT_CODES.has(error.code)) return true;
    const meta = error.meta as Record<string, unknown> | undefined;
    const adapterError = meta?.driverAdapterError;
    if (adapterError && typeof adapterError === 'object') {
      const cause = (adapterError as Record<string, unknown>).cause;
      if (cause && typeof cause === 'object') {
        const kind = (cause as Record<string, unknown>).kind;
        if (typeof kind === 'string' && kind === 'ConnectionClosed') return true;
      }
      const msg = String(adapterError);
      if (TRANSIENT_MESSAGES.some((m) => msg.includes(m))) return true;
    }
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    const msg = error.message;
    if (TRANSIENT_MESSAGES.some((m) => msg.includes(m))) return true;
  }

  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code ?? '';
    if (TRANSIENT_MESSAGES.includes(code)) return true;
    if (TRANSIENT_MESSAGES.some((m) => error.message.includes(m))) return true;
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface DbRetryOptions {
  /** Max number of attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in ms between retries; uses exponential back-off (default: 500) */
  delayMs?: number;
  /** Optional logger for retry warnings */
  logger?: Logger;
  /** Label used in log messages */
  label?: string;
}

/**
 * Wraps a Prisma database operation with automatic retry on transient connection errors.
 * Retries on: P1017 (ConnectionClosed), ENETUNREACH, ECONNRESET, ETIMEDOUT, etc.
 */
export async function withDbRetry<T>(
  operation: () => Promise<T>,
  options: DbRetryOptions = {},
): Promise<T> {
  const { maxRetries = 3, delayMs = 500, logger, label = 'db operation' } = options;

  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      attempt++;

      if (attempt >= maxRetries || !isTransientError(error)) {
        throw error;
      }

      const wait = delayMs * Math.pow(2, attempt - 1); // Exponential back-off
      logger?.warn(
        `[withDbRetry] ${label}: transient error on attempt ${attempt}/${maxRetries}, retrying in ${wait}ms. Error: ${error instanceof Error ? error.message : String(error)}`,
      );

      await sleep(wait);
    }
  }
}
