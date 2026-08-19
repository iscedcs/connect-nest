import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { CpContextGuard } from '../guards/cp-context.guard';
import { CpRolesGuard } from '../guards/cp-roles.guard';
import { CpRoles } from '../decorators/cp-roles.decorator';
import { CpContext } from '../decorators/cp-context.decorator';
import { CpRequestContext } from '../types/cp-request.types';
import { CpRole } from '../../generated/prisma/client';
import { CreateJobDto } from './dto/create-job.dto';
import { ApplyJobDto } from './dto/apply-job.dto';
import { Request } from 'express';
import { AuthGuard } from '../../auth/auth.guard';

@ApiTags('Connect Plus - Jobs')
@Controller('cp')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  // ─── Workspace Admin Routes ──────────────────────────────────────────

  @ApiBearerAuth('access-token')
  @UseGuards(CpContextGuard, CpRolesGuard)
  @Post('jobs')
  @CpRoles(CpRole.CREATOR, CpRole.WORKSPACE_ADMIN)
  @ApiOperation({ summary: 'Create a new job post' })
  createJob(
    @CpContext() ctx: CpRequestContext,
    @Body() dto: CreateJobDto,
    @Req() req: Request,
  ) {
    return this.jobsService.createJob(ctx, dto, req);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(CpContextGuard, CpRolesGuard)
  @Get('jobs')
  @CpRoles(CpRole.CREATOR, CpRole.WORKSPACE_ADMIN)
  @ApiOperation({ summary: 'List all job posts for the workspace' })
  listWorkspaceJobs(@CpContext() ctx: CpRequestContext) {
    return this.jobsService.listWorkspaceJobs(ctx);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(CpContextGuard, CpRolesGuard)
  @Get('jobs/:jobId/applications')
  @CpRoles(CpRole.CREATOR, CpRole.WORKSPACE_ADMIN)
  @ApiOperation({ summary: 'List all applications for a specific job' })
  listApplications(
    @CpContext() ctx: CpRequestContext,
    @Param('jobId') jobId: string,
  ) {
    return this.jobsService.listApplications(ctx, jobId);
  }

  // ─── Public / Artisan Routes ─────────────────────────────────────────

  @Get('jobs/public')
  @ApiOperation({ summary: 'List public jobs' })
  listPublicJobs(
    @Query('skills') skills?: string,
    @Query('jobType') jobType?: string,
    @Query('workModel') workModel?: string,
  ) {
    return this.jobsService.listPublicJobs({ skills, jobType, workModel });
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get job details' })
  getJob(@Param('id') id: string) {
    return this.jobsService.getJob(id);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard)
  @Post('jobs/:id/apply')
  @ApiOperation({ summary: 'Apply to a job post' })
  applyToJob(
    @Req() req: Request,
    @Param('id') jobId: string,
    @Body() dto: ApplyJobDto,
  ) {
    return this.jobsService.applyToJob((req as any).user.id, jobId, dto);
  }
}
