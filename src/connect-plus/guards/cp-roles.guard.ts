import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CpRole } from '../../generated/prisma/client';
import { CP_ROLES_KEY } from '../decorators/cp-roles.decorator';
import { CpRequestContext } from '../types/cp-request.types';
import { Request } from 'express';

@Injectable()
export class CpRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<CpRole[]>(
      CP_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const req = context
      .switchToHttp()
      .getRequest<Request & { cp?: CpRequestContext }>();
    const cpCtx = req.cp;

    if (!cpCtx) {
      throw new ForbiddenException('Workspace context not resolved');
    }

    // The organization owner is a workspace admin by default: a route open to
    // WORKSPACE_ADMIN is open to CREATOR too. Routes that list only CREATOR,
    // STAFF or CLIENT are unaffected.
    const allowed =
      requiredRoles.includes(cpCtx.role) ||
      (cpCtx.role === CpRole.CREATOR &&
        requiredRoles.includes(CpRole.WORKSPACE_ADMIN));

    if (!allowed) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}
