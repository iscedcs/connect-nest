import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './indicators/prisma-health.indicator';
import { HealthMonitorService } from './health-monitor.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthMonitor: any;

  beforeEach(async () => {
    healthMonitor = { checkHealth: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            check: jest.fn().mockResolvedValue({
              status: 'ok',
              info: { database: { status: 'up' } },
            }),
          },
        },
        { provide: PrismaHealthIndicator, useValue: { isHealthy: jest.fn() } },
        { provide: HealthMonitorService, useValue: healthMonitor },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('returns the health payload', async () => {
    const res: any = await controller.check();
    expect(res.status).toBe('ok');
    expect(typeof res.uptime).toBe('number');
  });

  /**
   * The regression that mattered. checkHealth is called fire-and-forget, so
   * without a .catch() its rejection is an unhandled rejection and Node exits.
   * That made this public, unauthenticated, throttle-exempt route a remote
   * kill switch: on 2026-09-24 every GET /api/health terminated the container.
   *
   * Asserted by listening for 'unhandledRejection' — Node emits it whether or
   * not a handler is installed, so this discriminates the fixed code from the
   * broken code rather than merely observing that Jest survived.
   */
  it('leaves no unhandled rejection when checkHealth fails', async () => {
    const seen: unknown[] = [];
    const onUnhandled = (reason: unknown) => seen.push(reason);
    process.on('unhandledRejection', onUnhandled);

    try {
      healthMonitor.checkHealth.mockRejectedValue(new Error('P2021 table missing'));

      await controller.check();
      // Let the rejection settle: unhandledRejection is emitted after the
      // microtask queue drains.
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));

      expect(seen).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('still returns a healthy payload even when monitoring fails', async () => {
    healthMonitor.checkHealth.mockRejectedValue(new Error('boom'));

    const res: any = await controller.check();
    await new Promise((r) => setImmediate(r));

    expect(res.status).toBe('ok');
  });
});
