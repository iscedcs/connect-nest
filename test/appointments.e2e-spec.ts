import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from '../src/database/database.service';
import { setupE2eApp } from './setup';
import { CpRole, CpAppointmentStatus } from '../src/generated/prisma/client';
import { AppointmentsScheduler } from '../src/connect-plus/cp-appointments/appointments.scheduler';

describe('Appointments (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let adminToken: string;
  let staffToken: string;
  let clientToken: string;
  let workspaceId: string;
  let workspaceSlug: string;
  let staffId: string;
  let clientId: string;

  beforeAll(async () => {
    const adminAuthId = `test-admin-${Date.now()}`;
    const staffAuthId = `test-staff-${Date.now()}`;
    const clientAuthId = `test-client-${Date.now()}`;

    const setupAdmin = await setupE2eApp(adminAuthId);
    app = setupAdmin.app;
    db = setupAdmin.db;
    adminToken = setupAdmin.token;

    staffToken = (await setupE2eApp(staffAuthId)).token;
    clientToken = (await setupE2eApp(clientAuthId)).token;

    const org = await db.cpOrganization.create({
      data: { name: 'Org', slug: `org-${Date.now()}`, creatorAuthId: adminAuthId, status: 'ACTIVE' }
    });

    workspaceSlug = `ws-${Date.now()}`;
    const ws = await db.cpWorkspace.create({
      data: { name: 'WS', slug: workspaceSlug, organizationId: org.id, status: 'ACTIVE' }
    });
    workspaceId = ws.id;

    await db.cpCompanyProfile.create({
      data: { workspaceId, name: 'Profile' }
    });

    // Admin Member
    await db.cpWorkspaceMember.create({
      data: { workspaceId, authUserId: adminAuthId, role: CpRole.WORKSPACE_ADMIN, status: 'ACTIVE' }
    });

    // Staff Member
    const staffMember = await db.cpWorkspaceMember.create({
      data: { workspaceId, authUserId: staffAuthId, role: CpRole.STAFF, status: 'ACTIVE' }
    });

    // Staff Profile
    const staffProfile = await db.cpStaffProfile.create({
      data: { 
        workspaceId, 
        authUserId: staffAuthId, 
        name: 'Staff A',
        member: { connect: { id: staffMember.id } }
      }
    });
    staffId = staffProfile.id;

    // Client
    const client = await db.cpClient.create({
      data: { workspaceId, authUserId: clientAuthId, name: 'Client A', email: 'client@example.com' }
    });
    clientId = client.id;
    
    // Add client workspace member
    await db.cpWorkspaceMember.create({
      data: { workspaceId, authUserId: clientAuthId, role: CpRole.CLIENT, status: 'ACTIVE', clientRecord: { connect: { id: clientId } } }
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Conflict Detection', () => {
    it('creates an initial appointment', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/cp/appointments')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          title: 'Appt 1',
          scheduledAt: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
          staffId: staffId,
          clientId: clientId,
        });
      expect(res.status).toBe(201);
    });

    it('rejects a conflicting appointment for the same staff', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/cp/appointments')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          title: 'Appt 2 Conflict',
          scheduledAt: new Date(Date.now() + 86400000).toISOString(), // Exact same time
          staffId: staffId,
          clientId: clientId,
        });
      expect(res.status).toBe(409);
    });

    it('rejects a conflicting public appointment', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/cp/public/${workspaceSlug}/appointments`)
        .send({
          title: 'Public Conflict',
          name: 'Public User',
          email: 'public@example.com',
          scheduledAt: new Date(Date.now() + 86400000).toISOString(), // Exact same time
          staffId: staffId,
        });
      expect(res.status).toBe(409);
    });
  });

  describe('Status Transition Matrix', () => {
    let apptId: string;

    beforeAll(async () => {
      const appt = await db.cpAppointment.create({
        data: {
          workspaceId,
          title: 'Matrix Test',
          scheduledAt: new Date(),
          staffId,
          status: CpAppointmentStatus.PENDING,
          type: 'CLIENT'
        }
      });
      apptId = appt.id;
    });

    it('rejects illegal transition (PENDING -> COMPLETED directly)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/cp/appointments/${apptId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-workspace-id', workspaceId)
        .send({ status: 'COMPLETED' });
      expect(res.status).toBe(409);
    });

    it('allows legal transition (PENDING -> CONFIRMED)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/cp/appointments/${apptId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-workspace-id', workspaceId)
        .send({ status: 'CONFIRMED' });
      expect(res.status).toBe(200);
    });
    
    it('executes NO_SHOW cron for past-due appointments', async () => {
      // Set to way in the past
      await db.cpAppointment.update({
        where: { id: apptId },
        data: { scheduledAt: new Date(Date.now() - 48 * 60 * 60 * 1000) }
      });
      
      const scheduler = app.get(AppointmentsScheduler);
      await scheduler.autoNoShowPastDue();
      
      const appt = await db.cpAppointment.findUnique({ where: { id: apptId } });
      expect(appt?.status).toBe(CpAppointmentStatus.NO_SHOW);
    });
  });

  describe('RBAC Visibility', () => {
    it('allows staff to see assigned appointments', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/cp/appointments/assigned')
        .set('Authorization', `Bearer ${staffToken}`)
        .set('x-workspace-id', workspaceId);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('allows client to see only their own appointments', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/cp/appointments/me')
        .set('Authorization', `Bearer ${clientToken}`)
        .set('x-workspace-id', workspaceId);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
    });
    
    it('denies client access to all workspace appointments', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/cp/appointments')
        .set('Authorization', `Bearer ${clientToken}`)
        .set('x-workspace-id', workspaceId);
      expect(res.status).toBe(403);
    });
  });
});
