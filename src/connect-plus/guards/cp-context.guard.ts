import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CpRole, CpMemberStatus } from '../../generated/prisma/client';
import { CpRequestContext, IsceAuthPayload } from '../types/cp-request.types';
import { Request } from 'express';

@Injectable()
export class CpContextGuard implements CanActivate {
  constructor(private readonly db: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { isce_auth?: IsceAuthPayload; cp?: CpRequestContext }
    >();

    const authPayload = req.isce_auth;
    if (!authPayload?.id) {
      throw new UnauthorizedException();
    }
    const authUserId = authPayload.id;

    // Creator routes — path starts with /api/cp/organizations
    if (req.path.startsWith('/api/cp/organizations')) {
      const org = await this.db.cpOrganization.findFirst({
        where: { creatorAuthId: authUserId },
      });

      // Allow POST /api/cp/organizations even before an org exists (first-time creation)
      if (!org && req.method === 'POST' && req.path === '/api/cp/organizations') {
        req.cp = {
          authUserId,
          organizationId: '',
          role: CpRole.CREATOR,
        };
        return true;
      }

      if (!org) {
        throw new ForbiddenException('No organization found for this user');
      }
      req.cp = {
        authUserId,
        organizationId: org.id,
        role: CpRole.CREATOR,
      };
      return true;
    }

    // If no x-workspace-id header, try CREATOR fallback (workspace management routes)
    const workspaceId = req.headers['x-workspace-id'];
    if (!workspaceId || typeof workspaceId !== 'string') {
      const org = await this.db.cpOrganization.findFirst({
        where: { creatorAuthId: authUserId },
      });
      if (!org) {
        throw new BadRequestException('x-workspace-id header is required');
      }
      req.cp = {
        authUserId,
        organizationId: org.id,
        role: CpRole.CREATOR,
      };
      return true;
    }

    const member = await this.db.cpWorkspaceMember.findUnique({
      where: { workspaceId_authUserId: { workspaceId, authUserId } },
      include: { workspace: { select: { organizationId: true } } },
    });

    if (!member) {
      throw new ForbiddenException('Not a member of this workspace');
    }
    if (member.status === CpMemberStatus.SUSPENDED) {
      throw new ForbiddenException('Account suspended');
    }
    if (member.status === CpMemberStatus.REMOVED) {
      throw new ForbiddenException('Access revoked');
    }

    req.cp = {
      authUserId,
      workspaceId,
      organizationId: member.workspace.organizationId,
      role: member.role as CpRole,
      memberId: member.id,
    };
    return true;
  }
}
