import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * Guards internal service-to-service endpoints.
 * Requires the `X-Internal-Secret` header to match
 * the `INTERNAL_API_KEY` environment variable.
 *
 * Apply on top of `@PublicRoute()` so the global JWT AuthGuard
 * is bypassed while this guard enforces the shared secret.
 */
@Injectable()
export class InternalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers['x-internal-secret'];
    const expected = process.env.INTERNAL_API_KEY;

    if (!expected) {
      throw new ForbiddenException('INTERNAL_API_KEY is not configured');
    }

    if (!provided || provided !== expected) {
      throw new ForbiddenException('Invalid or missing internal secret');
    }

    return true;
  }
}
