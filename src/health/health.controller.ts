import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { PublicRoute } from '../auth/decorators/public-route.decorator';
import { PrismaHealthIndicator } from './indicators/prisma-health.indicator';
import { HealthMonitorService } from './health-monitor.service';

@ApiTags('Health')
@Controller('health')
@PublicRoute()
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly healthMonitor: HealthMonitorService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Public health check' })
  @ApiResponse({ status: 200, description: 'System healthy' })
  @ApiResponse({ status: 503, description: 'System unhealthy / Database unreachable' })
  async check() {
    // Incident tracking rides on inbound hits (external uptime monitor) rather
    // than an in-process timer, so the DB can autosuspend between checks.
    void this.healthMonitor.checkHealth();

    const result = await this.health.check([
      () => this.prismaIndicator.isHealthy('database'),
    ]);

    return {
      ...result,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV ?? 'development',
    };
  }

  @Get('debug-sentry')
  @ApiOperation({ summary: 'Trigger test error for Sentry verification' })
  @ApiResponse({ status: 500, description: 'Triggers test error' })
  getError() {
    throw new Error('My first Sentry error!');
  }
}
