import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CpRequestContext } from '../types/cp-request.types';
import { CpNotificationsService } from '../notifications/notifications.service';
import { JobType, WorkModel, CpNotificationType } from '../../generated/prisma/client';

@Injectable()
export class TalentService {
  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: CpNotificationsService,
  ) {}

  async searchTalent(query: { keyword?: string, skills?: string, jobTypes?: string, workModels?: string }) {
    const where: any = {
      openToWork: true,
      status: 'ACTIVE',
    };

    if (query.keyword) {
      where.OR = [
        { bio: { contains: query.keyword, mode: 'insensitive' } },
        { profile: { position: { contains: query.keyword, mode: 'insensitive' } } },
      ];
    }

    if (query.skills) {
      where.skills = { hasSome: query.skills.split(',') };
    }
    
    if (query.jobTypes) {
      where.desiredJobTypes = { hasSome: query.jobTypes.split(',') as JobType[] };
    }

    if (query.workModels) {
      where.desiredWorkModels = { hasSome: query.workModels.split(',') as WorkModel[] };
    }

    return this.db.artisan.findMany({
      where,
      include: {
        profile: true,
        services: true,
      },
      orderBy: { averageRating: 'desc' },
      take: 50,
    });
  }

  async inviteToJob(ctx: CpRequestContext, artisanId: string, jobId: string) {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId) throw new ForbiddenException('Workspace context required');

    const job = await this.db.cpJobPost.findUnique({
      where: { id: jobId, workspaceId },
      include: { workspace: true }
    });

    if (!job) throw new NotFoundException('Job post not found in this workspace');

    const artisan = await this.db.artisan.findUnique({
      where: { id: artisanId },
      include: { profile: true }
    });

    if (!artisan) throw new NotFoundException('Artisan not found');

    const existingApp = await this.db.cpJobApplication.findFirst({
      where: { jobId, artisanId }
    });

    if (existingApp) {
      throw new ForbiddenException('Artisan has already applied to this job');
    }

    // Send invitation notification
    this.notifications.send({
      recipientAuthId: artisan.profile.userId,
      type: CpNotificationType.NEW_MESSAGE, // Fallback if no specific invite type
      title: 'Job Invitation',
      message: `You have been invited by ${job.workspace.name} to apply for the position: ${job.title}`,
      metadata: { jobId, workspaceId },
    });

    return { success: true, message: 'Invitation sent' };
  }

  async getSavedTalent(ctx: CpRequestContext) {
    if (!ctx.workspaceId) throw new ForbiddenException('Workspace context required');

    return this.db.cpSavedTalent.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: {
        artisan: {
          include: { profile: true, services: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async saveTalent(ctx: CpRequestContext, artisanId: string, notes?: string) {
    if (!ctx.workspaceId) throw new ForbiddenException('Workspace context required');

    const artisan = await this.db.artisan.findUnique({ where: { id: artisanId } });
    if (!artisan) throw new NotFoundException('Artisan not found');

    return this.db.cpSavedTalent.upsert({
      where: {
        workspaceId_artisanId: { workspaceId: ctx.workspaceId, artisanId }
      },
      update: { notes },
      create: {
        workspaceId: ctx.workspaceId,
        artisanId,
        notes,
      }
    });
  }

  async removeSavedTalent(ctx: CpRequestContext, artisanId: string) {
    if (!ctx.workspaceId) throw new ForbiddenException('Workspace context required');

    await this.db.cpSavedTalent.deleteMany({
      where: { workspaceId: ctx.workspaceId, artisanId }
    });

    return { success: true };
  }
}
