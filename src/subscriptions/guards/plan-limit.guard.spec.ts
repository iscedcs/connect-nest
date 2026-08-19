import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlanLimitGuard } from './plan-limit.guard';
import { SubscriptionsService } from '../subscriptions.service';
import { SystemConfigService } from '../../system-config/system-config.service';
import { PLAN_FEATURE_KEY } from '../decorators/plan-feature.decorator';
import { PlanLimitException } from '../exceptions/plan-limit.exception';

describe('PlanLimitGuard', () => {
  let guard: PlanLimitGuard;
  let subscriptionsService: jest.Mocked<Partial<SubscriptionsService>>;
  let reflector: jest.Mocked<Partial<Reflector>>;
  let systemConfigService: jest.Mocked<Partial<SystemConfigService>>;

  const mockContext = (userId?: string): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          isce_auth: userId ? { id: userId } : undefined,
        }),
      }),
      getHandler: () => ({}),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    subscriptionsService = {
      getUserLimits: jest.fn(),
    };
    reflector = {
      get: jest.fn(),
    };
    systemConfigService = {
      isPersonalBypassed: jest.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanLimitGuard,
        { provide: SubscriptionsService, useValue: subscriptionsService },
        { provide: Reflector, useValue: reflector },
        { provide: SystemConfigService, useValue: systemConfigService },
      ],
    }).compile();

    guard = module.get<PlanLimitGuard>(PlanLimitGuard);
  });

  it('should allow access if no feature metadata is present', async () => {
    (reflector.get as jest.Mock).mockReturnValue(undefined);
    const result = await guard.canActivate(mockContext('usr_123'));
    expect(result).toBe(true);
  });

  it('should immediately bypass check if subscriptions are disabled in OPEN_ACCESS mode', async () => {
    (reflector.get as jest.Mock).mockReturnValue('socialLinks');
    (systemConfigService.isPersonalBypassed as jest.Mock).mockResolvedValue(true);

    const result = await guard.canActivate(mockContext('usr_123'));
    expect(result).toBe(true);
    expect(subscriptionsService.getUserLimits).not.toHaveBeenCalled();
  });

  it('should throw PlanLimitException if feature limit is 0 / false when not bypassed', async () => {
    (reflector.get as jest.Mock).mockReturnValue('contactExport');
    (systemConfigService.isPersonalBypassed as jest.Mock).mockResolvedValue(false);
    (subscriptionsService.getUserLimits as jest.Mock).mockResolvedValue({
      contactExport: false,
    });

    await expect(guard.canActivate(mockContext('usr_123'))).rejects.toThrow(
      PlanLimitException,
    );
  });

  it('should allow access if feature is enabled in user limits', async () => {
    (reflector.get as jest.Mock).mockReturnValue('contactExport');
    (systemConfigService.isPersonalBypassed as jest.Mock).mockResolvedValue(false);
    (subscriptionsService.getUserLimits as jest.Mock).mockResolvedValue({
      contactExport: true,
    });

    const result = await guard.canActivate(mockContext('usr_123'));
    expect(result).toBe(true);
  });
});
