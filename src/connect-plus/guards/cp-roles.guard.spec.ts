import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CpRolesGuard } from './cp-roles.guard';
import { CpRole } from '../../generated/prisma/client';

function ctxFor(role: CpRole | undefined): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({ cp: role ? { role } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('CpRolesGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const guard = new CpRolesGuard(reflector as unknown as Reflector);

  const allow = (roles: CpRole[] | undefined) =>
    reflector.getAllAndOverride.mockReturnValue(roles);

  it('allows any role when the route declares none', () => {
    allow(undefined);
    expect(guard.canActivate(ctxFor(CpRole.CLIENT))).toBe(true);
  });

  it('allows a role listed on the route', () => {
    allow([CpRole.STAFF]);
    expect(guard.canActivate(ctxFor(CpRole.STAFF))).toBe(true);
  });

  it('lets CREATOR through a WORKSPACE_ADMIN-only route', () => {
    allow([CpRole.WORKSPACE_ADMIN]);
    expect(guard.canActivate(ctxFor(CpRole.CREATOR))).toBe(true);
  });

  it('does not let CREATOR into STAFF-only or CLIENT-only routes', () => {
    allow([CpRole.STAFF]);
    expect(() => guard.canActivate(ctxFor(CpRole.CREATOR))).toThrow(ForbiddenException);
    allow([CpRole.CLIENT]);
    expect(() => guard.canActivate(ctxFor(CpRole.CREATOR))).toThrow(ForbiddenException);
  });

  it('does not let WORKSPACE_ADMIN into CREATOR-only routes', () => {
    allow([CpRole.CREATOR]);
    expect(() => guard.canActivate(ctxFor(CpRole.WORKSPACE_ADMIN))).toThrow(ForbiddenException);
  });

  it('rejects STAFF and CLIENT on admin routes', () => {
    allow([CpRole.WORKSPACE_ADMIN]);
    expect(() => guard.canActivate(ctxFor(CpRole.STAFF))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctxFor(CpRole.CLIENT))).toThrow(ForbiddenException);
  });

  it('rejects when the workspace context was not resolved', () => {
    allow([CpRole.STAFF]);
    expect(() => guard.canActivate(ctxFor(undefined))).toThrow(ForbiddenException);
  });
});
