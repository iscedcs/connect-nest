import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from '../src/database/database.service';
import { setupE2eApp } from './setup';

describe('CpLeads (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  const mockUserId = `test-leads-creator-${Date.now()}`;
  let workspaceId: string;
  let workspaceSlug: string;
  let leadId: string;

  let token: string;

  beforeAll(async () => {
    const setup = await setupE2eApp(mockUserId);
    app = setup.app;
    db = setup.db;
    token = setup.token;

    const org = await db.cpOrganization.create({
      data: {
        name: 'Test Leads Org',
        slug: `leads-org-slug-${Date.now()}`,
        creatorAuthId: mockUserId,
        status: 'ACTIVE',
      }
    });

    workspaceSlug = `leads-ws-slug-${Date.now()}`;
    const workspace = await db.cpWorkspace.create({
      data: {
        name: 'Test Leads Workspace',
        slug: workspaceSlug,
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

  it('/api/cp/public/:workspaceSlug/contacts/save (POST) - capture lead', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/cp/public/${workspaceSlug}/contacts/save`)
      .send({
        name: 'John Doe',
        email: 'john.doe@example.com'
      })
      .expect(200);

    expect(res.body.leadId).toBeDefined();
    leadId = res.body.leadId;
  });

  it('/api/cp/leads (GET) - get workspace leads', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/cp/leads')
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId)
      .expect(200);

    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].id).toBe(leadId);
  });
});
