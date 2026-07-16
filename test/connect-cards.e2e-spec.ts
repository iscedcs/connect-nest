import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from '../src/database/database.service';
import { setupE2eApp } from './setup';
import { CpRole, CpCardStatus } from '../src/generated/prisma/client';

describe('Connect Cards (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  const mockUserId = `test-cards-${Date.now()}`;
  let token: string;
  let workspaceId: string;
  let cardId: string;

  let adminAuthId: string;
  let adminToken: string;

  beforeAll(async () => {
    const setup = await setupE2eApp(mockUserId);
    app = setup.app;
    db = setup.db;
    token = setup.token;

    adminAuthId = `admin-${Date.now()}`;
    adminToken = (await setupE2eApp(adminAuthId)).token;

    const org = await db.cpOrganization.create({
      data: { name: 'Org', slug: `org-cards-${Date.now()}`, creatorAuthId: mockUserId, status: 'ACTIVE' }
    });
    const ws = await db.cpWorkspace.create({
      data: { name: 'WS', slug: `ws-cards-${Date.now()}`, organizationId: org.id, status: 'ACTIVE' }
    });
    workspaceId = ws.id;
    await db.cpWorkspaceMember.create({
      data: { workspaceId, authUserId: adminAuthId, role: CpRole.WORKSPACE_ADMIN, status: 'ACTIVE' }
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a new card in inventory', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/cp/staff/cards')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ cardCode: `NFC-${Date.now()}` })
      .expect(201);
    
    cardId = res.body.id;
    expect(res.body.status).toBe(CpCardStatus.UNASSIGNED);
  });

  it('pairs the card to staff', async () => {
    const member = await db.cpWorkspaceMember.findFirst({ where: { workspaceId } });
    const profile = await db.cpStaffProfile.create({
      data: {
        workspaceId,
        memberId: member!.id,
        authUserId: member!.authUserId,
        name: 'Test Staff',
      }
    });

    const res = await request(app.getHttpServer())
      .patch(`/api/cp/staff/cards/${cardId}/pair`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ staffId: profile.id })
      .expect(200);

    expect(res.body.status).toBe(CpCardStatus.ACTIVE);
    expect(res.body.staffId).toBe(profile.id);
  });

  it('updates card status to LOST [CRM-5]', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/cp/staff/cards/${cardId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ status: CpCardStatus.LOST })
      .expect(200);

    expect(res.body.status).toBe(CpCardStatus.LOST);
  });

  it('unpairs the card and resets status to UNASSIGNED', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/cp/staff/cards/${cardId}/unpair`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-workspace-id', workspaceId)
      .expect(200);

    expect(res.body.status).toBe(CpCardStatus.UNASSIGNED);
    expect(res.body.staffId).toBeNull();
  });
});
