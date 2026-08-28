import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { SuperAdminGuard } from './super-admin.guard';

describe('SuperAdminGuard', () => {
  let guard: SuperAdminGuard;

  beforeEach(() => {
    guard = new SuperAdminGuard();
  });

  function createMockContext(user?: any): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          isce_auth: user,
        }),
      }),
    } as any;
  }

  it('should allow access when user is SUPER_ADMIN', () => {
    const context = createMockContext({ id: 'admin_1', userType: 'SUPER_ADMIN' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException when user is not SUPER_ADMIN', () => {
    const context = createMockContext({ id: 'user_1', userType: 'USER' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw UnauthorizedException when no user is attached to request', () => {
    const context = createMockContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
