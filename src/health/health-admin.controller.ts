import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Request,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DatabaseService } from '../database/database.service';
import { HealthMonitorService } from './health-monitor.service';
import { IncidentQueryDto } from './dto/incident-query.dto';
import { HealthIncidentStatus } from '../generated/prisma/client';

@ApiTags('Health Admin')
@ApiBearerAuth('access-token')
@Controller('health')
export class HealthAdminController {
  constructor(
    private readonly db: DatabaseService,
    private readonly monitor: HealthMonitorService,
  ) {}

  private ensureSuperAdmin(req: any) {
    const user = req.isce_auth;
    if (!user || user.userType !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Access denied — Super Admin only');
    }
  }

  /**
   * GET /api/health/status
   * Returns current failure counts and any open incidents per dependency.
   */
  @Get('status')
  @ApiOperation({ summary: '[Super Admin] Current health status' })
  @ApiResponse({ status: 200, description: 'Current health state' })
  @ApiResponse({ status: 403, description: 'Super Admin only' })
  async getStatus(@Request() req: any) {
    this.ensureSuperAdmin(req);

    const failureCounts = this.monitor.getCurrentFailureCounts();

    const openIncidents = await this.db.healthIncident.findMany({
      where: { status: HealthIncidentStatus.OPEN },
      orderBy: { startedAt: 'desc' },
    });

    return {
      threshold: 3,
      dependencies: Object.entries(failureCounts).map(([dep, count]) => ({
        dependency: dep,
        consecutiveFailures: count,
        isHealthy: count === 0,
        openIncident: openIncidents.find((i) => i.dependency === dep) ?? null,
      })),
    };
  }

  /**
   * GET /api/health/incidents?page=1&limit=20
   * Paginated incident history, newest first.
   */
  @Get('incidents')
  @ApiOperation({ summary: '[Super Admin] Paginated incident history' })
  @ApiResponse({ status: 200, description: 'Incident list' })
  @ApiResponse({ status: 403, description: 'Super Admin only' })
  async getIncidents(
    @Request() req: any,
    @Query(new ValidationPipe({ transform: true })) query: IncidentQueryDto,
  ) {
    this.ensureSuperAdmin(req);

    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [incidents, total] = await Promise.all([
      this.db.healthIncident.findMany({
        skip,
        take: limit,
        orderBy: { startedAt: 'desc' },
      }),
      this.db.healthIncident.count(),
    ]);

    return {
      data: incidents,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
