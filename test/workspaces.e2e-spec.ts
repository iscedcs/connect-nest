import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from '../src/database/database.service';
import { setupE2eApp } from './setup';

describe('CpWorkspaces (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  const mockUserId = `test-ws-creator-${Date.now()}`;
  let orgId: string;
  let workspaceId: string;

  let token: string;

  beforeAll(async () => {
    const setup = await setupE2eApp(mockUserId);
    app = setup.app;
    db = setup.db;
    token = setup.token;

    // Create an organization first so we can create workspaces
    const org = await db.cpOrganization.create({
      data: {
        name: 'Test WS Org',
        slug: `ws-org-slug-${Date.now()}`,
        creatorAuthId: mockUserId,
        status: 'ACTIVE',
      }
    });
    orgId = org.id;
  });

  afterAll(async () => {
    // Cleanup the created org (cascades to workspaces)
    await db.cpOrganization.deleteMany({
      where: { creatorAuthId: mockUserId }
    });
    await app.close();
  });

  it('/api/cp/workspaces (POST) - create workspace', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/cp/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'My New Workspace',
        slug: `my-ws-slug-${Date.now()}`,
        companyProfile: {
          tagline: 'Test Tagline',
          description: 'A test description',
        }
      })
      .expect(201);

    expect(res.body.name).toBe('My New Workspace');
    workspaceId = res.body.id;

    // Verify creator workspace membership was created
    const member = await db.cpWorkspaceMember.findUnique({
      where: {
        workspaceId_authUserId: {
          workspaceId,
          authUserId: mockUserId,
        },
      },
    });
    expect(member).not.toBeNull();
    expect(member?.role).toBe('CREATOR');
    expect(member?.status).toBe('ACTIVE');
  });

  it('/api/cp/my-workspaces (GET) - list user workspace memberships', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/cp/my-workspaces')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toBeInstanceOf(Array);
    const myWs = res.body.find((item: { workspace: { id: string } }) => item.workspace.id === workspaceId);
    expect(myWs).toBeDefined();
    expect(myWs.role).toBe('CREATOR');
  });

  it('/api/cp/workspaces (GET) - get all workspaces', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/cp/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('/api/cp/workspaces/:id (GET) - get single workspace with x-workspace-id header', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/cp/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId)
      .expect(200);

    expect(res.body.id).toBe(workspaceId);
    expect(res.body.companyProfile.name).toBe('My New Workspace');
  });

  it('/api/cp/workspaces/:id/status (PATCH) - update status', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/cp/workspaces/${workspaceId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId)
      .send({ status: 'SUSPENDED' })
      .expect(200);

    expect(res.body.status).toBe('SUSPENDED');
  });
});
