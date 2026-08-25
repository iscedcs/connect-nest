import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsService } from './subscriptions.service';
import { DatabaseService } from '../database/database.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { PlanTier, SubscriptionStatus } from '../generated/prisma/client';
import { PLAN_LIMITS, UNLIMITED_PLAN_LIMITS } from './plan-limits.config';

import { NotificationDispatcher } from '../notification/notification-dispatcher.service';

describe('SubscriptionsService (Personal Dynamic Limits)', () => {
  let service: SubscriptionsService;
  let db: any;
  let systemConfigService: jest.Mocked<Partial<SystemConfigService>>;
  let notifications: any;

  beforeEach(async () => {
    db = {
      subscription: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      plan: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    notifications = {
      dispatch: jest.fn(),
      send: jest.fn(),
    };

    systemConfigService = {
      isPersonalSubscriptionEnabled: jest.fn().mockResolvedValue(true),
      isPersonalBypassed: jest.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: DatabaseService, useValue: db },
        { provide: NotificationDispatcher, useValue: notifications },
        { provide: SystemConfigService, useValue: systemConfigService },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
  });

  describe('getUserLimits', () => {
    it('should return UNLIMITED_PLAN_LIMITS when bypassed', async () => {
      (systemConfigService.isPersonalBypassed as jest.Mock).mockResolvedValue(true);

      const limits = await service.getUserLimits('usr_123');
      expect(limits).toEqual(UNLIMITED_PLAN_LIMITS);
      expect(db.subscription.findUnique).not.toHaveBeenCalled();
    });

    it('should return default FREE limits when user has no active subscription and plan not in DB', async () => {
      (db.subscription.findUnique as jest.Mock).mockResolvedValue(null);
      (db.plan.findUnique as jest.Mock).mockResolvedValue(null);

      const limits = await service.getUserLimits('usr_123');
      expect(limits.profiles).toBe(1);
      expect(limits.socialLinks).toBe(3);
    });

    it('should merge custom JSON limits from database for PRO_LITE', async () => {
      (db.subscription.findUnique as jest.Mock).mockResolvedValue({
        userId: 'usr_pro',
        status: SubscriptionStatus.ACTIVE,
        plan: {
          key: PlanTier.PRO_LITE,
          name: 'Pro Lite Customized',
          priceMonthly: 120000,
          limits: {
            socialLinks: 25,
            contactExport: true,
            storageBytes: -1, // Translates to Infinity
          },
        },
      });

      const limits = await service.getUserLimits('usr_pro');
      expect(limits.socialLinks).toBe(25);
      expect(limits.storageBytes).toBe(Infinity);
      // Unspecified features retain defaults
      expect(limits.profiles).toBe(2);
    });
  });

  describe('updatePlanDetails', () => {
    it('should update price, name, and limits, returning resolvedLimits', async () => {
      (db.plan.findUnique as jest.Mock).mockResolvedValue({
        key: PlanTier.PRO_PLUS,
        name: 'Pro Plus',
        priceMonthly: 150000,
        limits: {},
      });

      (db.plan.update as jest.Mock).mockResolvedValue({
        id: 'plan_pro_plus',
        key: PlanTier.PRO_PLUS,
        name: 'Pro Plus Premium',
        priceMonthly: 200000,
        isActive: true,
        limits: {
          profiles: 10,
          socialLinks: -1,
        },
      });

      const result = await service.updatePlanDetails(PlanTier.PRO_PLUS, {
        name: 'Pro Plus Premium',
        priceMonthly: 200000,
        limits: { profiles: 10, socialLinks: -1 },
      });

      expect(result.name).toBe('Pro Plus Premium');
      expect(result.priceMonthly).toBe(200000);
      expect(result.resolvedLimits.profiles).toBe(10);
      expect(result.resolvedLimits.socialLinks).toBe(Infinity);
    });
  });

  describe('createSubscription & getActiveSubscription', () => {
    it('should create FREE subscription with status ACTIVE for new users', async () => {
      (db.subscription.findUnique as jest.Mock).mockResolvedValue(null);
      (db.plan.findUnique as jest.Mock).mockResolvedValue({ id: 'plan_free', key: PlanTier.FREE });
      (db.subscription.create as jest.Mock).mockResolvedValue({
        id: 'sub_free',
        userId: 'usr_new',
        planId: 'plan_free',
        status: SubscriptionStatus.ACTIVE,
        trialStartDate: null,
        trialEndDate: null,
        trialUsed: false,
      });

      const sub = await service.createSubscription('usr_new', PlanTier.FREE);
      expect(sub.status).toBe(SubscriptionStatus.ACTIVE);
      expect(sub.trialUsed).toBe(false);
      expect(db.subscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'usr_new',
          status: SubscriptionStatus.ACTIVE,
          trialUsed: false,
        }),
      });
    });

    it('should create paid plan trial with 6-month trial window and status TRIALING', async () => {
      (db.subscription.findUnique as jest.Mock).mockResolvedValue(null);
      (db.plan.findUnique as jest.Mock).mockResolvedValue({ id: 'plan_pro', key: PlanTier.PRO_LITE });
      (db.subscription.create as jest.Mock).mockResolvedValue({
        id: 'sub_pro',
        userId: 'usr_trial',
        planId: 'plan_pro',
        status: SubscriptionStatus.TRIALING,
        trialStartDate: new Date(),
        trialEndDate: new Date(Date.now() + 180 * 86400000),
        trialUsed: true,
      });

      const sub = await service.createSubscription('usr_trial', PlanTier.PRO_LITE);
      expect(sub.status).toBe(SubscriptionStatus.TRIALING);
      expect(sub.trialUsed).toBe(true);
      expect(db.subscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'usr_trial',
          status: SubscriptionStatus.TRIALING,
          trialUsed: true,
          trialStartDate: expect.any(Date),
          trialEndDate: expect.any(Date),
        }),
      });
    });

    it('should auto-bootstrap a FREE subscription on getActiveSubscription for legacy users without one', async () => {
      (db.subscription.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // getActiveSubscription check
        .mockResolvedValueOnce(null) // createSubscription check
        .mockResolvedValueOnce({
          id: 'sub_legacy',
          userId: 'usr_legacy',
          planId: 'plan_free',
          status: SubscriptionStatus.ACTIVE,
          plan: { key: PlanTier.FREE, name: 'Free' },
        }); // getActiveSubscription re-fetch after bootstrap

      (db.plan.findUnique as jest.Mock).mockResolvedValue({ id: 'plan_free', key: PlanTier.FREE });
      (db.subscription.create as jest.Mock).mockResolvedValue({
        id: 'sub_legacy',
        userId: 'usr_legacy',
        planId: 'plan_free',
        status: SubscriptionStatus.ACTIVE,
      });

      const sub = await service.getActiveSubscription('usr_legacy');
      expect(sub.id).toBe('sub_legacy');
      expect(db.subscription.create).toHaveBeenCalled();
    });
  });
});
