import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from '../src/database/database.service';
import { setupE2eApp } from './setup';

describe('CpOrganizations (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  const mockUserId = `test-org-creator-${Date.now()}`;

  let token: string;

  beforeAll(async () => {
    const setup = await setupE2eApp(mockUserId);
    app = setup.app;
    db = setup.db;
    token = setup.token;
  });

  afterAll(async () => {
    // Cleanup the created org
    await db.cpOrganization.deleteMany({
      where: { creatorAuthId: mockUserId }
    });
    await app.close();
  });

  it('/api/cp/organizations (POST) - create org', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/cp/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test E2E Organization',
        slug: `test-org-slug-${Date.now()}`,
      })
      .expect(201);

    expect(res.body.name).toBe('Test E2E Organization');
    expect(res.body.creatorAuthId).toBe(mockUserId);
  });

  it('/api/cp/organizations (POST) - fail duplicate', async () => {
    // Attempt to create another one, should fail due to existing org for this user
    const res = await request(app.getHttpServer())
      .post('/api/cp/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Another Org',
        slug: `another-slug-${Date.now()}`,
      })
      .expect(409);

    expect(res.body.message).toBeDefined();
  });

  it('/api/cp/organizations/me (GET) - get my org', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/cp/organizations/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.name).toBe('Test E2E Organization');
  });

  it('/api/cp/organizations/me (PATCH) - update org', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/cp/organizations/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated E2E Organization',
      })
      .expect(200);

    expect(res.body.name).toBe('Updated E2E Organization');
  });

  it('/api/cp/organizations/me (DELETE) - archive org', async () => {
    const res = await request(app.getHttpServer())
      .delete('/api/cp/organizations/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.message).toBe('Organization archived');
  });
});
