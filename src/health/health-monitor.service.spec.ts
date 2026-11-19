import { Test, TestingModule } from '@nestjs/testing';
import { HealthMonitorService } from './health-monitor.service';
import { DatabaseService } from '../database/database.service';
import { MailClientService } from '../mail/mail-client.service';

/**
 * checkHealth is invoked fire-and-forget from the public /health route, so a
 * rejection escaping it is an unhandled rejection and Node terminates the
 * process. On 2026-09-24 a missing HealthIncident table made every GET
 * /api/health kill the container. These tests pin that it cannot recur.
 */
describe('HealthMonitorService', () => {
  let service: HealthMonitorService;
  let db: any;
  let mailer: any;

  const tableMissing = () =>
    Object.assign(new Error('The table `public.HealthIncident` does not exist'), {
      code: 'P2021',
    });

  beforeEach(async () => {
    db = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      healthIncident: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'inc_1', startedAt: new Date() }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    mailer = { sendEmail: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthMonitorService,
        { provide: DatabaseService, useValue: db },
        { provide: MailClientService, useValue: mailer },
      ],
    }).compile();

    service = module.get<HealthMonitorService>(HealthMonitorService);
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
    jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
    jest.spyOn((service as any).logger, 'log').mockImplementation(() => undefined);
  });

  it('resolves normally when everything works', async () => {
    await expect(service.checkHealth()).resolves.toBeUndefined();
    expect(db.$queryRaw).toHaveBeenCalled();
  });

  it('does not reject when incident bookkeeping throws on the success path', async () => {
    db.healthIncident.findFirst.mockRejectedValue(tableMissing());

    await expect(service.checkHealth()).resolves.toBeUndefined();
  });

  it('does not reject when the alerting path throws during a real outage', async () => {
    db.$queryRaw.mockRejectedValue(new Error('connection refused'));
    db.healthIncident.findFirst.mockRejectedValue(tableMissing());

    await expect(service.checkHealth()).resolves.toBeUndefined();
  });

  it('does not reject when creating an incident throws', async () => {
    db.$queryRaw.mockRejectedValue(new Error('connection refused'));
    db.healthIncident.create.mockRejectedValue(new Error('write failed'));

    await expect(service.checkHealth()).resolves.toBeUndefined();
  });

  // A failure to record an incident is not evidence the dependency is down.
  // Previously handleSuccess ran inside the probe's try/catch, so a broken
  // HealthIncident table was reported as Postgres being unreachable and sent
  // an outage email for a database that was answering queries perfectly well.
  it('does not raise a false outage alert when only bookkeeping is broken', async () => {
    db.healthIncident.findFirst.mockRejectedValue(tableMissing());

    await service.checkHealth();

    expect(db.$queryRaw).toHaveBeenCalled();
    expect(mailer.sendEmail).not.toHaveBeenCalled();
    expect(db.healthIncident.create).not.toHaveBeenCalled();
    expect(service.getCurrentFailureCounts().POSTGRES).toBe(0);
  });

  it('still alerts on a genuine dependency outage', async () => {
    db.$queryRaw.mockRejectedValue(new Error('connection refused'));

    await service.checkHealth();

    expect(db.healthIncident.create).toHaveBeenCalled();
    expect(mailer.sendEmail).toHaveBeenCalled();
    expect(service.getCurrentFailureCounts().POSTGRES).toBe(1);
  });

  it('resolves an open incident once the dependency recovers', async () => {
    db.healthIncident.findFirst.mockResolvedValue({ id: 'inc_1' });

    await service.checkHealth();

    expect(db.healthIncident.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inc_1' } }),
    );
  });
});
