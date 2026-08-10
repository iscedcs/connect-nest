import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const user = (req as any).isce_auth;

    if (!user) {
      throw new UnauthorizedException();
    }

    if (user.userType !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Super Admin access required');
    }

    return true;
  }
}
