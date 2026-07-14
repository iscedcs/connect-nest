import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CpRequestContext } from '../types/cp-request.types';
import { CreateJobDto } from './dto/create-job.dto';
import { ApplyJobDto } from './dto/apply-job.dto';
import { CpAuditLogService } from '../audit-logs/cp-audit-log.service';
import { Request } from 'express';

@Injectable()
export class JobsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auditLog: CpAuditLogService,
  ) {}

  async createJob(ctx: CpRequestContext, dto: CreateJobDto, req: Request) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId) throw new ForbiddenException('Workspace context required');

    const job = await this.db.cpJobPost.create({
      data: {
        workspaceId,
        title: dto.title,
        description: dto.description,
        jobType: dto.jobType,
        workModel: dto.workModel,
        requiredSkills: dto.requiredSkills,
        minBudget: dto.minBudget,
        maxBudget: dto.maxBudget,
      },
    });

    this.auditLog.write({
      ctx,
      req,
      workspaceId,
      organizationId: ctx.organizationId,
      eventType: 'JOB_CREATED',
      targetEntity: 'CpJobPost',
      targetEntityId: job.id,
      action: 'CREATE',
      after: job as any,
    });

    return job;
  }

  async listWorkspaceJobs(ctx: CpRequestContext) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId) throw new ForbiddenException('Workspace context required');

    return this.db.cpJobPost.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { applications: true }
        }
      }
    });
  }

  async listPublicJobs(query: { skills?: string, jobType?: string, workModel?: string }) {
    // Simple global search for Artisans
    const where: any = { isActive: true };

    if (query.skills) {
      where.requiredSkills = { hasSome: query.skills.split(',') };
    }
    if (query.jobType) {
      where.jobType = query.jobType;
    }
    if (query.workModel) {
      where.workModel = query.workModel;
    }

    return this.db.cpJobPost.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        workspace: {
          include: { companyProfile: true }
        }
      }
    });
  }

  async getJob(id: string) {
    const job = await this.db.cpJobPost.findUnique({
      where: { id },
      include: {
        workspace: {
          include: { companyProfile: true }
        }
      }
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async applyToJob(authUserId: string, jobId: string, dto: ApplyJobDto) {
    const job = await this.db.cpJobPost.findUnique({ where: { id: jobId } });
    if (!job || !job.isActive) throw new NotFoundException('Job not found or inactive');

    const artisan = await this.db.artisan.findFirst({
      where: { profile: { userId: authUserId } }
    });

    if (!artisan) {
      throw new ForbiddenException('You must have an Artisan profile to apply');
    }

    const existing = await this.db.cpJobApplication.findFirst({
      where: { jobId, artisanId: artisan.id }
    });

    if (existing) {
      throw new ForbiddenException('You have already applied to this job');
    }

    return this.db.cpJobApplication.create({
      data: {
        jobId,
        artisanId: artisan.id,
        coverLetter: dto.coverLetter,
        resumeUrl: dto.resumeUrl,
      }
    });
  }

  async listApplications(ctx: CpRequestContext, jobId: string) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId) throw new ForbiddenException('Workspace context required');

    const job = await this.db.cpJobPost.findUnique({ where: { id: jobId, workspaceId } });
    if (!job) throw new NotFoundException('Job not found in this workspace');

    return this.db.cpJobApplication.findMany({
      where: { jobId },
      include: {
        artisan: {
          include: {
            profile: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}
