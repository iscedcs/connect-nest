import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from '../src/database/database.service';
import { setupE2eApp } from './setup';

describe('CpJobs (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  const mockUserId = `test-jobs-creator-${Date.now()}`;
  let workspaceId: string;
  let jobId: string;

  let token: string;

  beforeAll(async () => {
    const setup = await setupE2eApp(mockUserId);
    app = setup.app;
    db = setup.db;
    token = setup.token;

    const org = await db.cpOrganization.create({
      data: {
        name: 'Test Jobs Org',
        slug: `jobs-org-slug-${Date.now()}`,
        creatorAuthId: mockUserId,
        status: 'ACTIVE',
      }
    });

    const workspace = await db.cpWorkspace.create({
      data: {
        name: 'Test Jobs Workspace',
        slug: `jobs-ws-slug-${Date.now()}`,
        organizationId: org.id,
        status: 'ACTIVE',
      }
    });
    workspaceId = workspace.id;

    // Make user a workspace admin
    await db.cpWorkspaceMember.create({
      data: {
        workspaceId,
        authUserId: mockUserId,
        role: 'WORKSPACE_ADMIN',
        status: 'ACTIVE'
      }
    });
  });

  afterAll(async () => {
    await db.cpOrganization.deleteMany({
      where: { creatorAuthId: mockUserId }
    });
    await app.close();
  });

  it('/api/cp/jobs (POST) - create job', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/cp/jobs')
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId)
      .send({
        title: 'Senior NestJS Developer',
        description: 'Looking for a backend dev',
        jobType: 'FULL_TIME',
        workModel: 'REMOTE',
        requiredSkills: ['Node.js', 'NestJS'],
      })
      .expect(201);

    expect(res.body.title).toBe('Senior NestJS Developer');
    jobId = res.body.id;
  });

  it('/api/cp/jobs (GET) - get workspace jobs', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/cp/jobs')
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId)
      .expect(200);

    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].id).toBe(jobId);
  });
});
