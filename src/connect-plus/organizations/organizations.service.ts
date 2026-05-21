import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { CpRequestContext } from '../types/cp-request.types';
import { CpAuditLogService } from '../audit-logs/cp-audit-log.service';
import { toSlug, toSlugWithSuffix } from '../utils/slug';
import { Prisma } from '../../generated/prisma/client';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { Request } from 'express';

@Injectable()
export class CpOrganizationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auditLog: CpAuditLogService,
  ) {}

  async create(
    ctx: CpRequestContext,
    dto: CreateOrganizationDto,
    req: Request,
  ) {
    // Check if creator already has an org
    const existing = await this.db.cpOrganization.findFirst({
      where: { creatorAuthId: ctx.authUserId },
    });
    if (existing) {
      throw new ConflictException('Organization already exists for this user');
    }

    const slug = await this.generateOrgSlug(dto.name);

    const org = await this.db.cpOrganization.create({
      data: {
        creatorAuthId: ctx.authUserId,
        name: dto.name,
        slug,
        settings: dto.settings as Prisma.InputJsonValue | undefined,
      },
    });

    this.auditLog.write({
      ctx,
      req,
      organizationId: org.id,
      eventType: 'ORG_CREATED',
      targetEntity: 'CpOrganization',
      targetEntityId: org.id,
      action: 'CREATE',
      after: org as Record<string, unknown>,
    });

    return org;
  }

  async getMyOrg(ctx: CpRequestContext) {
    const org = await this.db.cpOrganization.findFirst({
      where: { creatorAuthId: ctx.authUserId, deletedAt: null },
      include: { workspaces: { where: { deletedAt: null }, select: { id: true, name: true, slug: true, status: true } } },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async update(
    ctx: CpRequestContext,
    dto: UpdateOrganizationDto,
    req: Request,
  ) {
    const org = await this.db.cpOrganization.findFirst({
      where: { creatorAuthId: ctx.authUserId, deletedAt: null },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) {
      updateData.name = dto.name;
      updateData.slug = await this.generateOrgSlug(dto.name);
    }
    if (dto.settings !== undefined) updateData.settings = dto.settings;

    const updated = await this.db.cpOrganization.update({
      where: { id: org.id },
      data: updateData,
    });

    this.auditLog.write({
      ctx,
      req,
      organizationId: org.id,
      eventType: 'ORG_UPDATED',
      targetEntity: 'CpOrganization',
      targetEntityId: org.id,
      action: 'UPDATE',
      before: org as Record<string, unknown>,
      after: updated as Record<string, unknown>,
    });

    return updated;
  }

  async archive(ctx: CpRequestContext, req: Request) {
    const org = await this.db.cpOrganization.findFirst({
      where: { creatorAuthId: ctx.authUserId, deletedAt: null },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const updated = await this.db.cpOrganization.update({
      where: { id: org.id },
      data: { status: 'ARCHIVED', deletedAt: new Date() },
    });

    this.auditLog.write({
      ctx,
      req,
      organizationId: org.id,
      eventType: 'ORG_ARCHIVED',
      targetEntity: 'CpOrganization',
      targetEntityId: org.id,
      action: 'DELETE',
      before: org as Record<string, unknown>,
      after: updated as Record<string, unknown>,
    });

    return { message: 'Organization archived' };
  }

  private async generateOrgSlug(name: string): Promise<string> {
    const base = toSlug(name);
    let slug = base || `org-${randomBytes(2).toString('hex')}`;
    for (let attempt = 0; attempt < 6; attempt++) {
      const existing = await this.db.cpOrganization.findUnique({
        where: { slug },
      });
      if (!existing) return slug;
      slug = toSlugWithSuffix(base || 'org');
    }
    throw new ConflictException('Could not generate a unique slug');
  }
}

