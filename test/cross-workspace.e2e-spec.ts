import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from '../src/database/database.service';
import { setupE2eApp } from './setup';
import { CpRole } from '../src/generated/prisma/client';

describe('Cross-Workspace Isolation (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  
  const userA = `user-a-${Date.now()}`;
  let tokenA: string;
  let wsA: string;

  const userB = `user-b-${Date.now()}`;
  let tokenB: string;
  let wsB: string;

  beforeAll(async () => {
    const setupA = await setupE2eApp(userA);
    app = setupA.app; // reuse app
    db = setupA.db;
    tokenA = setupA.token;
    tokenB = (await setupE2eApp(userB)).token;

    const orgA = await db.cpOrganization.create({
      data: { name: 'Org A', slug: `org-a-${Date.now()}`, creatorAuthId: userA, status: 'ACTIVE' }
    });
    const workspaceA = await db.cpWorkspace.create({
      data: { name: 'WS A', slug: `ws-a-${Date.now()}`, organizationId: orgA.id, status: 'ACTIVE' }
    });
    wsA = workspaceA.id;
    await db.cpWorkspaceMember.create({
      data: { workspaceId: wsA, authUserId: userA, role: CpRole.CREATOR, status: 'ACTIVE' }
    });

    const orgB = await db.cpOrganization.create({
      data: { name: 'Org B', slug: `org-b-${Date.now()}`, creatorAuthId: userB, status: 'ACTIVE' }
    });
    const workspaceB = await db.cpWorkspace.create({
      data: { name: 'WS B', slug: `ws-b-${Date.now()}`, organizationId: orgB.id, status: 'ACTIVE' }
    });
    wsB = workspaceB.id;
    await db.cpWorkspaceMember.create({
      data: { workspaceId: wsB, authUserId: userB, role: CpRole.CREATOR, status: 'ACTIVE' }
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows user A to act on workspace A', async () => {
    await request(app.getHttpServer())
      .get('/api/cp/staff')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-workspace-id', wsA)
      .expect(200);
  });

  it('blocks user A from acting on workspace B', async () => {
    await request(app.getHttpServer())
      .get('/api/cp/staff')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-workspace-id', wsB)
      .expect(403);
  });

  it('blocks user B from acting on workspace A', async () => {
    await request(app.getHttpServer())
      .get('/api/cp/staff')
      .set('Authorization', `Bearer ${tokenB}`)
      .set('x-workspace-id', wsA)
      .expect(403);
  });
});
