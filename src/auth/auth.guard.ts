import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { Request } from 'express';
import { IS_PUBLIC_ROUTE_KEY } from './decorators/public-route.decorator';

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
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error('JWT_SECRET environment variable is not set');
      }

      // Verify the JWT signature and decode the payload
      const verified = jwt.verify(token, secret) as JwtPayload;

      // Attach verified user info to the request
      (request as any).isce_auth = verified;
      return true;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException('Token has expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedException('Invalid token');
      }
      throw new UnauthorizedException('Unauthorized');
    }
  }
}
