import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { setupE2eApp } from './setup';
import { DatabaseService } from '../src/database/database.service';
import { PlanTier } from '../src/generated/prisma/client';

describe('Default Profile Provisioning (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let token: string;
  const userId = 'e2e-default-profile-user-1';
  const internalUserId = 'e2e-default-profile-user-2';
  const prevInternalKey = process.env.INTERNAL_API_KEY;

  beforeAll(async () => {
    process.env.INTERNAL_API_KEY =
      process.env.INTERNAL_API_KEY || 'test-internal-secret';
    const setup = await setupE2eApp(userId);
    app = setup.app;
    db = setup.db;
    token = setup.token;

    await db.subscription.deleteMany({
      where: { userId: { in: [userId, internalUserId] } },
    });
    await db.profile.deleteMany({
      where: { userId: { in: [userId, internalUserId] } },
    });
  });

  afterAll(async () => {
    await db.subscription.deleteMany({
      where: { userId: { in: [userId, internalUserId] } },
    });
    await db.profile.deleteMany({
      where: { userId: { in: [userId, internalUserId] } },
    });
    process.env.INTERNAL_API_KEY = prevInternalKey;
    await app.close();
  });

  it('rejects /api/internal/profile/ensure-default without valid secret (403)', async () => {
    await request(app.getHttpServer())
      .post('/api/internal/profile/ensure-default')
      .send({ authUserId: internalUserId, name: 'Test User' })
      .expect(403);
  });

  it('creates exactly one default profile and FREE subscription even under concurrent internal calls', async () => {
    const secret = process.env.INTERNAL_API_KEY!;
    const [res1, res2] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/internal/profile/ensure-default')
        .set('X-Internal-Secret', secret)
        .send({
          authUserId: internalUserId,
          name: 'Concurrent User',
          profilePhoto: 'https://example.com/photo.jpg',
        }),
      request(app.getHttpServer())
        .post('/api/internal/profile/ensure-default')
        .set('X-Internal-Secret', secret)
        .send({
          authUserId: internalUserId,
          name: 'Concurrent User',
        }),
    ]);

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect([res1.body.created, res2.body.created].sort()).toEqual([
      false,
      true,
    ]);

    const profiles = await db.profile.findMany({
      where: { userId: internalUserId, deletedAt: null },
    });
    expect(profiles).toHaveLength(1);
    expect(profiles[0].is_default).toBe(true);
    expect(profiles[0].slug).toBeTruthy();

    const sub = await db.subscription.findUnique({
      where: { userId: internalUserId },
      include: { plan: true },
    });
    expect(sub).toBeTruthy();
    expect(sub?.plan.key).toBe(PlanTier.FREE);
  });

  it('allows signed-in user to idempotently ensure default profile via /api/profile/ensure-default', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/profile/ensure-default')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Signed In User' })
      .expect(201);

    expect(first.body.success).toBe(true);
    expect(first.body.created).toBe(true);
    expect(first.body.data.profile.is_default).toBe(true);

    const second = await request(app.getHttpServer())
      .post('/api/profile/ensure-default')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Different Name' })
      .expect(201);

    expect(second.body.success).toBe(true);
    expect(second.body.created).toBe(false);
    expect(second.body.data.profile.id).toBe(first.body.data.profile.id);
  });
});
