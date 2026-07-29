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
    const req = context
      .switchToHttp()
      .getRequest<
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
      include: { 
        workspace: { 
          select: { 
            organizationId: true,
            organization: { select: { creatorAuthId: true } }
          } 
        } 
      },
    });

    if (!member) {
      // Fallback: check if the user is the org creator and this workspace
      // belongs to their org. This covers cases where the membership row
      // wasn't created (e.g., pre-existing workspaces or a failed tx).
      const workspace = await this.db.cpWorkspace.findUnique({
        where: { id: workspaceId },
        include: { organization: { select: { id: true, creatorAuthId: true } } },
      });

      if (workspace && workspace.organization.creatorAuthId === authUserId) {
        // Ensure a membership row exists going forward (auto-repair)
        const repairedMember = await this.db.cpWorkspaceMember.upsert({
          where: { workspaceId_authUserId: { workspaceId, authUserId } },
          create: {
            workspaceId,
            authUserId,
            role: CpRole.CREATOR,
            status: 'ACTIVE',
            joinedAt: new Date(),
          },
          update: {},
        });

        req.cp = {
          authUserId,
          workspaceId,
          organizationId: workspace.organization.id,
          role: CpRole.CREATOR,
          memberId: repairedMember.id,
        };
        return true;
      }

      throw new ForbiddenException('Not a member of this workspace');
    }
    if (member.status === CpMemberStatus.SUSPENDED) {
      throw new ForbiddenException('Account suspended');
    }
    if (member.status === CpMemberStatus.REMOVED) {
      throw new ForbiddenException('Access revoked');
    }

    let effectiveRole = member.role as CpRole;
    if (member.workspace.organization.creatorAuthId === authUserId) {
      effectiveRole = CpRole.CREATOR;
    } else if (effectiveRole === CpRole.CREATOR) {
      effectiveRole = CpRole.WORKSPACE_ADMIN;
    }

    req.cp = {
      authUserId,
      workspaceId,
      organizationId: member.workspace.organizationId,
      role: effectiveRole,
      memberId: member.id,
    };
    return true;
  }
}
