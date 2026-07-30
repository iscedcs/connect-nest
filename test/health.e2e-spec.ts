import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { DatabaseService } from '../src/database/database.service';
import { setupE2eApp } from './setup';
import { jwtSecret } from '../utils/constants';
import { HealthDependency, HealthIncidentStatus } from '../src/generated/prisma/client';

describe('HealthMonitoring (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  const regularUserId = `test-regular-user-${Date.now()}`;
  const superAdminUserId = `test-superadmin-user-${Date.now()}`;

  let regularToken: string;
  let superAdminToken: string;
  let createdIncidentId: string;

  beforeAll(async () => {
    const setup = await setupE2eApp(regularUserId);
    app = setup.app;
    db = setup.db;
    regularToken = setup.token;

    // Create a Super Admin token
    superAdminToken = jwt.sign(
      {
        id: superAdminUserId,
        email: 'superadmin@example.com',
        userType: 'SUPER_ADMIN',
      },
      jwtSecret,
    );
  });

  afterAll(async () => {
    if (createdIncidentId) {
      await db.healthIncident.deleteMany({
        where: { id: createdIncidentId },
      });
    }
    await app.close();
  });

  it('/api/health/status (GET) - 403 for non-SUPER_ADMIN', async () => {
    await request(app.getHttpServer())
      .get('/api/health/status')
      .set('Authorization', `Bearer ${regularToken}`)
      .expect(403);
  });

  it('/api/health/status (GET) - 200 for SUPER_ADMIN', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/health/status')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('threshold', 3);
    expect(Array.isArray(res.body.dependencies)).toBe(true);
    const postgresDep = res.body.dependencies.find((d: any) => d.dependency === 'POSTGRES');
    expect(postgresDep).toBeDefined();
    expect(postgresDep).toHaveProperty('isHealthy');
  });

  it('/api/health/incidents (GET) - 403 for non-SUPER_ADMIN', async () => {
    await request(app.getHttpServer())
      .get('/api/health/incidents')
      .set('Authorization', `Bearer ${regularToken}`)
      .expect(403);
  });

  it('/api/health/incidents (GET) - 200 for SUPER_ADMIN', async () => {
    // Create a dummy incident to verify list output
    const incident = await db.healthIncident.create({
      data: {
        dependency: HealthDependency.POSTGRES,
        status: HealthIncidentStatus.OPEN,
        startedAt: new Date(),
        notifiedEmails: ['superadmin@example.com'],
      },
    });
    createdIncidentId = incident.id;

    const res = await request(app.getHttpServer())
      .get('/api/health/incidents?page=1&limit=10')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(res.body.meta).toEqual({
      total: expect.any(Number),
      page: 1,
      limit: 10,
      totalPages: expect.any(Number),
    });

    const found = res.body.data.find((i: any) => i.id === createdIncidentId);
    expect(found).toBeDefined();
    expect(found.dependency).toBe('POSTGRES');
    expect(found.status).toBe('OPEN');
  });

  it('/api/health/status (GET) - reflects open incident for SUPER_ADMIN', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/health/status')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    const postgresDep = res.body.dependencies.find((d: any) => d.dependency === 'POSTGRES');
    expect(postgresDep).toBeDefined();
    expect(postgresDep.openIncident).toBeDefined();
    expect(postgresDep.openIncident.id).toBe(createdIncidentId);
  });

  describe('GET /api/health (Public Terminus Check)', () => {
    it('/api/health (GET) - public 200 without auth header', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(res.body.info.database.status).toBe('up');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('environment');
    });

    it('/api/health (GET) - bypasses throttling (rapid requests)', async () => {
      // Send 35 rapid requests sequentially to verify @SkipThrottle bypasses 429 without overloading DB connection pool
      for (let i = 0; i < 35; i++) {
        const res = await request(app.getHttpServer()).get('/api/health');
        expect(res.status).toBe(200);
      }
    });

    it('/api/health/debug-sentry (GET) - triggers 500 Sentry error', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/health/debug-sentry')
        .expect(500);

      expect(res.body.message).toBe('Internal server error');
    });
  });
});
