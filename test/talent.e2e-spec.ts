import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { setupE2eApp } from './setup';
import { DatabaseService } from '../src/database/database.service';

describe('CpTalent (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let token: string;
  let workspaceId: string;
  let artisanId: string;
  let jobId: string;
  const mockUserId = 'test-creator-id';

  beforeAll(async () => {
    const setup = await setupE2eApp(mockUserId);
    app = setup.app;
    db = setup.db;
    token = setup.token;

    // Clean up
    await db.cpSavedTalent.deleteMany();
    await db.cpJobApplication.deleteMany();
    await db.cpJobPost.deleteMany();
    await db.cpWorkspace.deleteMany({ where: { organization: { creatorAuthId: mockUserId } } });
    await db.cpOrganization.deleteMany({ where: { creatorAuthId: mockUserId } });
    await db.artisan.deleteMany();
    await db.profile.deleteMany();

    // Create an organization
    const org = await db.cpOrganization.create({
      data: {
        creatorAuthId: mockUserId,
        name: 'Talent Org',
        slug: 'talent-org-' + Date.now(),
      },
    });

    // Create a workspace
    const workspace = await db.cpWorkspace.create({
      data: {
        organizationId: org.id,
        name: 'Talent Workspace',
        slug: 'talent-ws-' + Date.now(),
      },
    });
    workspaceId = workspace.id;

    // Create a Workspace Member for the mock user
    await db.cpWorkspaceMember.create({
      data: {
        workspaceId,
        authUserId: mockUserId,
        role: 'WORKSPACE_ADMIN',
        status: 'ACTIVE',
      }
    });

    // Create a Job Post
    const jobPost = await db.cpJobPost.create({
      data: {
        workspaceId,
        title: 'Backend Engineer',
        description: 'Need a nestjs engineer',
        jobType: 'FULL_TIME',
        workModel: 'REMOTE',
      }
    });
    jobId = jobPost.id;

    // Create an Artisan Profile
    const profile = await db.profile.create({
      data: {
        userId: 'artisan-user-id',
        name: 'John Artisan',
        position: 'Senior NestJS Developer',
      }
    });

    const artisan = await db.artisan.create({
      data: {
        profileId: profile.id,
        userId: 'artisan-user-id',
        bio: 'I build scalable backend systems in Node.js',
        status: 'ACTIVE',
        openToWork: true,
        skills: ['nestjs', 'typescript', 'postgresql'],
        desiredJobTypes: ['FULL_TIME', 'CONTRACT'],
        desiredWorkModels: ['REMOTE'],
      }
    });
    artisanId = artisan.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/cp/talent/search (GET) - search by keyword', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/cp/talent/search')
      .query({ keyword: 'nestjs' })
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId)
      .expect(200);

    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].id).toBe(artisanId);
  });

  it('/api/cp/talent/saved/:artisanId (POST) - save talent', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/cp/talent/saved/${artisanId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId)
      .send({ notes: 'Looks like a great fit' })
      .expect(201);

    expect(res.body.artisanId).toBe(artisanId);
    expect(res.body.notes).toBe('Looks like a great fit');
  });

  it('/api/cp/talent/saved (GET) - get saved talent', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/cp/talent/saved')
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId)
      .expect(200);

    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBe(1);
    expect(res.body[0].artisanId).toBe(artisanId);
    expect(res.body[0].artisan.profile.name).toBe('John Artisan');
  });

  it('/api/cp/talent/:artisanId/invite/:jobId (POST) - invite to job', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/cp/talent/${artisanId}/invite/${jobId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId)
      .expect(201);

    expect(res.body.success).toBe(true);
  });

  it('/api/cp/talent/saved/:artisanId (DELETE) - remove saved talent', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/cp/talent/saved/${artisanId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId)
      .expect(200);

    expect(res.body.success).toBe(true);

    const checkRes = await request(app.getHttpServer())
      .get('/api/cp/talent/saved')
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId)
      .expect(200);

    expect(checkRes.body.length).toBe(0);
  });
});
