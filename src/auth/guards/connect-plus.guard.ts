import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { CONNECT_PLUS_KEY } from '../decorators/connect-plus.decorator';
import { JwtPayload } from '../auth.guard';

@Injectable()
export class ConnectPlusGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Only enforce when the route is explicitly decorated with @ConnectPlus()
    const required = this.reflector.getAllAndOverride<boolean>(
      CONNECT_PLUS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).isce_auth as JwtPayload | undefined;

    if (!user) {
      throw new ForbiddenException('Authenticated user not found on request');
    }

    if (!user.iscePermissions?.connect_plus) {
      throw new ForbiddenException(
        'Connect Plus subscription required to access this feature',
      );
    }

    return true;
  }
}
