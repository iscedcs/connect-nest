import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DatabaseService } from '../database/database.service';
import { HealthMonitorService } from './health-monitor.service';
import { IncidentQueryDto } from './dto/incident-query.dto';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { HealthDependency, HealthIncidentStatus } from '../generated/prisma/client';

@ApiTags('Health Admin')
@ApiBearerAuth('access-token')
@UseGuards(SuperAdminGuard)
@Controller('health')
export class HealthAdminController {
  constructor(
    private readonly db: DatabaseService,
    private readonly monitor: HealthMonitorService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Get overall internal dependency health status' })
  @ApiResponse({ status: 200, description: 'Health status summary for super admins' })
  async getStatus() {
    const failureCounts = this.monitor.getCurrentFailureCounts();

    const openIncidents = await this.db.healthIncident.findMany({
      where: { status: HealthIncidentStatus.OPEN },
    });

    const incidentMap = new Map(openIncidents.map((i) => [i.dependency, i]));

    const dependencies = Object.values(HealthDependency).map((dep) => {
      const consecutiveFailures = failureCounts[dep] ?? 0;
      const openIncident = incidentMap.get(dep) ?? null;
      const isHealthy = !openIncident && consecutiveFailures === 0;

      return {
        dependency: dep,
        isHealthy,
        consecutiveFailures,
        openIncident,
      };
    });

    return {
      threshold: this.monitor.getThreshold(),
      dependencies,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('incidents')
  @ApiOperation({ summary: 'List health incident history' })
  @ApiResponse({ status: 200, description: 'Paginated list of health incidents' })
  async listIncidents(@Query() query: IncidentQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where = query.status ? { status: query.status } : {};

    const [data, total] = await Promise.all([
      this.db.healthIncident.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.db.healthIncident.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
