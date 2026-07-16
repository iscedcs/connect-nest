import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from '../src/database/database.service';
import { setupE2eApp } from './setup';
import * as crypto from 'crypto';

describe('Webhooks (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  const mockUserId = `test-wh-user-${Date.now()}`;
  let token: string;

  beforeAll(async () => {
    process.env.AUTH_INVITE_WEBHOOK_SECRET = 'test-secret';
    process.env.PAYSTACK_SECRET_KEY = 'test-secret';
    
    const setup = await setupE2eApp(mockUserId);
    app = setup.app;
    db = setup.db;
    token = setup.token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('ISCE Auth Webhook', () => {
    it('rejects without signature', async () => {
      await request(app.getHttpServer())
        .post('/api/cp/webhooks/invite-accepted')
        .send({ email: 'test@example.com', token: 'token', authUserId: 'user-1', role: 'STAFF', workspaceId: 'ws-1' })
        .expect(401);
    });

    it('rejects with invalid signature', async () => {
      await request(app.getHttpServer())
        .post('/api/cp/webhooks/invite-accepted')
        .set('x-webhook-signature', 'invalid-sig')
        .send({ email: 'test@example.com', token: 'token', authUserId: 'user-1', role: 'STAFF', workspaceId: 'ws-1' })
        .expect(401);
    });

    it('accepts with valid signature', async () => {
      const payload = { email: 'test@example.com', token: 'token', authUserId: 'user-1', role: 'STAFF', workspaceId: 'ws-1' };
      const secret = process.env.AUTH_INVITE_WEBHOOK_SECRET ?? '';
      const sig = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');

      // It might return 404 because the invite doesn't exist, but it shouldn't be 401
      const res = await request(app.getHttpServer())
        .post('/api/cp/webhooks/invite-accepted')
        .set('x-webhook-signature', sig)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(payload));
        
      expect(res.status).not.toBe(401);
    });
  });

  describe('Paystack Webhook', () => {
    it('rejects without signature', async () => {
      await request(app.getHttpServer())
        .post('/api/cp/webhooks/paystack')
        .send({ event: 'test' })
        .expect(401);
    });

    it('rejects with invalid signature', async () => {
      await request(app.getHttpServer())
        .post('/api/cp/webhooks/paystack')
        .set('x-paystack-signature', 'invalid-sig')
        .send({ event: 'test' })
        .expect(401);
    });

    it('accepts with valid signature', async () => {
      const payload = { event: 'charge.success', data: { reference: 'test' } };
      const secret = process.env.PAYSTACK_SECRET_KEY ?? '';
      const sig = crypto.createHmac('sha512', secret).update(JSON.stringify(payload)).digest('hex');

      const res = await request(app.getHttpServer())
        .post('/api/cp/webhooks/paystack')
        .set('x-paystack-signature', sig)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(payload));
        
      expect(res.status).not.toBe(401);
    });
  });
});
