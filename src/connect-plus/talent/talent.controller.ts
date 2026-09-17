import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseGuards,
  Body,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TalentService } from './talent.service';
import { CpContextGuard } from '../guards/cp-context.guard';
import { CpRolesGuard } from '../guards/cp-roles.guard';
import { CpRoles } from '../decorators/cp-roles.decorator';
import { CpContext } from '../decorators/cp-context.decorator';
import { CpRequestContext } from '../types/cp-request.types';
import { CpRole } from '../../generated/prisma/client';

@ApiTags('LYNCON Plus - Talent')
@ApiBearerAuth('access-token')
@UseGuards(CpContextGuard, CpRolesGuard)
@Controller('cp/talent')
export class TalentController {
  constructor(private readonly talentService: TalentService) {}

  @Get('search')
  @CpRoles(CpRole.CREATOR, CpRole.WORKSPACE_ADMIN)
  @ApiOperation({ summary: 'Search the global artisan directory for talent' })
  searchTalent(
    @Query('keyword') keyword?: string,
    @Query('skills') skills?: string,
    @Query('jobTypes') jobTypes?: string,
    @Query('workModels') workModels?: string,
  ) {
    return this.talentService.searchTalent({ keyword, skills, jobTypes, workModels });
  }

  @Post(':artisanId/invite/:jobId')
  @CpRoles(CpRole.CREATOR, CpRole.WORKSPACE_ADMIN)
  @ApiOperation({ summary: 'Invite an artisan to apply to a specific job post' })
  inviteToJob(
    @CpContext() ctx: CpRequestContext,
    @Param('artisanId') artisanId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.talentService.inviteToJob(ctx, artisanId, jobId);
  }

  @Get('saved')
  @CpRoles(CpRole.CREATOR, CpRole.WORKSPACE_ADMIN)
  @ApiOperation({ summary: 'Get saved talent for the workspace' })
  getSavedTalent(@CpContext() ctx: CpRequestContext) {
    return this.talentService.getSavedTalent(ctx);
  }

  @Post('saved/:artisanId')
  @CpRoles(CpRole.CREATOR, CpRole.WORKSPACE_ADMIN)
  @ApiOperation({ summary: 'Save an artisan to the workspace talent pool' })
  saveTalent(
    @CpContext() ctx: CpRequestContext,
    @Param('artisanId') artisanId: string,
    @Body('notes') notes?: string,
  ) {
    return this.talentService.saveTalent(ctx, artisanId, notes);
  }

  @Delete('saved/:artisanId')
  @CpRoles(CpRole.CREATOR, CpRole.WORKSPACE_ADMIN)
  @ApiOperation({ summary: 'Remove an artisan from the workspace talent pool' })
  removeSavedTalent(
    @CpContext() ctx: CpRequestContext,
    @Param('artisanId') artisanId: string,
  ) {
    return this.talentService.removeSavedTalent(ctx, artisanId);
  }
}
