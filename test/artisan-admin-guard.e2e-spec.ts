/**
 * e2e: ArtisanAdminController guard coverage
 *
 * Verifies that every route under /api/admin/artisan is protected by
 * SuperAdminGuard — i.e. the guard cannot be silently removed without
 * these tests failing.
 *
 * Three cases per representative endpoint:
 *   1. No Authorization header ? 401
 *   2. Valid JWT with userType != SUPER_ADMIN ? 403
 *   3. Valid JWT with userType == SUPER_ADMIN ? 2xx (actual result depends
 *      on DB state, but guard does not block)
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { setupE2eApp } from './setup';
import { jwtSecret } from '../utils/constants';

// Helper: mint a JWT with arbitrary payload
const mintToken = (payload: object) => jwt.sign(payload, jwtSecret as string);

describe('ArtisanAdminController — SuperAdminGuard (e2e)', () => {
  let app: INestApplication;

  // A valid JWT whose userType is NOT SUPER_ADMIN
  let regularToken: string;
  // A valid JWT whose userType IS SUPER_ADMIN
  let adminToken: string;

  beforeAll(async () => {
    const setup = await setupE2eApp('regular-user-id');
    app = setup.app;

    regularToken = mintToken({ id: 'regular-user-id', email: 'user@example.com', userType: 'USER' });
    adminToken   = mintToken({ id: 'admin-user-id',   email: 'admin@example.com', userType: 'SUPER_ADMIN' });
  });

  afterAll(async () => {
    await app.close();
  });

  // -- Probe endpoints ----------------------------------------------------

  const probes: { method: 'get' | 'post' | 'patch' | 'delete'; path: string }[] = [
    { method: 'get',    path: '/api/admin/artisan/list' },
    { method: 'get',    path: '/api/admin/artisan/settings' },
    { method: 'patch',  path: '/api/admin/artisan/settings' },
    { method: 'post',   path: '/api/admin/artisan/fake-id/approve' },
    { method: 'post',   path: '/api/admin/artisan/fake-id/suspend' },
    { method: 'post',   path: '/api/admin/artisan/fake-id/unsuspend' },
    { method: 'post',   path: '/api/admin/artisan/reviews/fake-id/toggle-visibility' },
    { method: 'post',   path: '/api/admin/artisan/categories' },
    { method: 'patch',  path: '/api/admin/artisan/categories/fake-id' },
    { method: 'delete', path: '/api/admin/artisan/categories/fake-id' },
  ];

  describe('returns 401 with no Authorization header', () => {
    probes.forEach(({ method, path }) => {
      it(`${method.toUpperCase()} ${path}`, async () => {
        const res = await (request(app.getHttpServer()) as any)[method](path);
        expect(res.status).toBe(401);
      });
    });
  });

  describe('returns 403 for a valid non-admin JWT', () => {
    probes.forEach(({ method, path }) => {
      it(`${method.toUpperCase()} ${path}`, async () => {
        const res = await (request(app.getHttpServer()) as any)
          [method](path)
          .set('Authorization', `Bearer ${regularToken}`);
        expect(res.status).toBe(403);
      });
    });
  });

  describe('passes the guard for a SUPER_ADMIN JWT (does not return 401 or 403)', () => {
    // We only test GET endpoints here to avoid side-effects in CI.
    // The guard is the same instance for all verbs, so one passing GET
    // is sufficient to confirm it is not blocking SUPER_ADMIN.
    const safeProbes = probes.filter((p) => p.method === 'get');

    safeProbes.forEach(({ method, path }) => {
      it(`${method.toUpperCase()} ${path}`, async () => {
        const res = await (request(app.getHttpServer()) as any)
          [method](path)
          .set('Authorization', `Bearer ${adminToken}`);
        // Guard passed — any non-auth error code is acceptable (e.g. 404, 500)
        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);
      });
    });
  });
});
