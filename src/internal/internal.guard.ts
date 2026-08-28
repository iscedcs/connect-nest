import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { timingSafeEqual } from 'crypto';

/**
 * Guards internal service-to-service endpoints.
 * Requires the `X-Internal-Secret` or `X-Internal-Api-Key` header to match
 * the `INTERNAL_API_KEY` environment variable.
 *
 * Apply on top of `@PublicRoute()` so the global JWT AuthGuard
 * is bypassed while this guard enforces the shared secret.
 */
@Injectable()
export class InternalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const headerVal =
      request.headers['x-internal-secret'] ||
      request.headers['x-internal-api-key'] ||
      request.headers['internal-api-key'];

    const provided = Array.isArray(headerVal) ? headerVal[0] : headerVal;
    const expected = process.env.INTERNAL_API_KEY;

    if (!expected) {
      throw new ForbiddenException('INTERNAL_API_KEY is not configured');
    }

    if (!provided || typeof provided !== 'string') {
      throw new ForbiddenException('Invalid or missing internal secret');
    }

    const providedBuf = Buffer.from(provided);
    const expectedBuf = Buffer.from(expected);

    if (
      providedBuf.length !== expectedBuf.length ||
      !timingSafeEqual(providedBuf, expectedBuf)
    ) {
      throw new ForbiddenException('Invalid or missing internal secret');
    }

    return true;
  }
}
