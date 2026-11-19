import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { Request } from 'express';
import { IS_PUBLIC_ROUTE_KEY } from './decorators/public-route.decorator';
import { TokenClaimsError, verifyAccessToken } from './token-verifier';

interface IscePermissions {
  connect: boolean;
  connect_plus: boolean;
  store: boolean;
  wallet: boolean;
  event: boolean;
  access: boolean;
}

export interface JwtPayload {
  id: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  displayPicture?: string;
  userType?: string;
  iscePermissions?: IscePermissions | null;
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_ROUTE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true; // Skip authentication for public routes
    }

    const request = context.switchToHttp().getRequest<Request>();
    let token = request.headers.authorization;

    if (!token) {
      throw new UnauthorizedException('Authorization header is missing');
    }

    // Remove "Bearer " prefix if present
    if (token.startsWith('Bearer ')) {
      token = token.slice(7);
    }

    try {
      // HS256 (legacy) and RS256 (JWKS) are both accepted during migration
      const { payload, method } = await verifyAccessToken<
        JwtPayload & jwt.JwtPayload
      >(token);
      this.logger.debug(
        `[JWT_MIGRATION] token accepted | method=${method} userId=${payload.id}`,
      );

      // Attach verified user info to the request
      (request as any).isce_auth = payload;
      return true;
    } catch (error) {
      if (error instanceof TokenClaimsError) {
        throw new UnauthorizedException('Invalid token claims');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException('Token has expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedException('Invalid token');
      }
      this.logger.error(`JWT verification failed: ${(error as Error).message}`);
      throw new UnauthorizedException('Unauthorized');
    }
  }
}
