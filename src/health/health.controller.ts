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
    //
    // The .catch() is load-bearing. This is fire-and-forget, so any rejection
    // escaping checkHealth is an unhandled rejection, and Node exits the
    // process on those. That turns this public, unauthenticated, throttle-
    // exempt route into a remote kill switch: on 2026-09-24 a missing
    // HealthIncident table meant every GET here terminated the container, so
    // monitoring the endpoint was indistinguishable from a crash-looping
    // deploy. checkHealth now also contains its own errors; this is the second
    // line of defence, and it stays even if that one is refactored away.
    void this.healthMonitor.checkHealth().catch(() => undefined);

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
