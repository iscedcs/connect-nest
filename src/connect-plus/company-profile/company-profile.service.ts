import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CpRequestContext } from '../types/cp-request.types';
import { CpAuditLogService } from '../audit-logs/cp-audit-log.service';
import { Prisma } from '../../generated/prisma/client';
import { UpsertCompanyProfileDto } from './dto/upsert-company-profile.dto';
import { Request } from 'express';

@Injectable()
export class CpCompanyProfileService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auditLog: CpAuditLogService,
  ) {}

  async get(ctx: CpRequestContext) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId)
      throw new ForbiddenException('Workspace context required');

    const profile = await this.db.cpCompanyProfile.findUnique({
      where: { workspaceId },
    });
    if (!profile) throw new NotFoundException('Company profile not found');
    return profile;
  }

  async upsert(
    ctx: CpRequestContext,
    dto: UpsertCompanyProfileDto,
    req: Request,
  ) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId)
      throw new ForbiddenException('Workspace context required');

    const existing = await this.db.cpCompanyProfile.findUnique({
      where: { workspaceId },
    });

    const profile = await this.db.cpCompanyProfile.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        name: dto.name,
        logo: dto.logo,
        description: dto.description,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        address: dto.address as Prisma.InputJsonValue | undefined,
        businessHours: dto.businessHours as unknown as Prisma.InputJsonValue | undefined,
        branding: dto.branding as Prisma.InputJsonValue | undefined,
        appointmentDefaults: dto.appointmentDefaults as
          Prisma.InputJsonValue | undefined,
        invoiceDefaults: dto.invoiceDefaults as
          Prisma.InputJsonValue | undefined,
        notificationPrefs: dto.notificationPrefs as
          Prisma.InputJsonValue | undefined,
      },
      update: {
        name: dto.name,
        logo: dto.logo,
        description: dto.description,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        address: dto.address as Prisma.InputJsonValue | undefined,
        businessHours: dto.businessHours as unknown as Prisma.InputJsonValue | undefined,
        branding: dto.branding as Prisma.InputJsonValue | undefined,
        appointmentDefaults: dto.appointmentDefaults as
          Prisma.InputJsonValue | undefined,
        invoiceDefaults: dto.invoiceDefaults as
          Prisma.InputJsonValue | undefined,
        notificationPrefs: dto.notificationPrefs as
          Prisma.InputJsonValue | undefined,
      },
    });

    this.auditLog.write({
      ctx,
      req,
      workspaceId,
      organizationId: ctx.organizationId,
      eventType: existing
        ? 'COMPANY_PROFILE_UPDATED'
        : 'COMPANY_PROFILE_CREATED',
      targetEntity: 'CpCompanyProfile',
      targetEntityId: profile.id,
      action: existing ? 'UPDATE' : 'CREATE',
      before: existing ? (existing as Record<string, unknown>) : undefined,
      after: profile as Record<string, unknown>,
    });

    return profile;
  }
}
