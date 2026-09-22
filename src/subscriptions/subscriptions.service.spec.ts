import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  PAST_DUE_GRACE_DAYS,
  RENEWAL_WINDOW_DAYS,
  SubscriptionsService,
} from './subscriptions.service';
import { DatabaseService } from '../database/database.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { PlanTier, SubscriptionStatus } from '../generated/prisma/client';
import { UNLIMITED_PLAN_LIMITS } from './plan-limits.config';

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
      (systemConfigService.isPersonalBypassed as jest.Mock).mockResolvedValue(
        true,
      );

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
      (db.plan.findUnique as jest.Mock).mockResolvedValue({
        id: 'plan_free',
        key: PlanTier.FREE,
      });
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
      (db.plan.findUnique as jest.Mock).mockResolvedValue({
        id: 'plan_pro',
        key: PlanTier.PRO_LITE,
      });
      (db.subscription.create as jest.Mock).mockResolvedValue({
        id: 'sub_pro',
        userId: 'usr_trial',
        planId: 'plan_pro',
        status: SubscriptionStatus.TRIALING,
        trialStartDate: new Date(),
        trialEndDate: new Date(Date.now() + 180 * 86400000),
        trialUsed: true,
      });

      const sub = await service.createSubscription(
        'usr_trial',
        PlanTier.PRO_LITE,
      );
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

      (db.plan.findUnique as jest.Mock).mockResolvedValue({
        id: 'plan_free',
        key: PlanTier.FREE,
      });
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

describe('SubscriptionsService (paid plan lifecycle)', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const NOW = new Date('2026-09-22T12:00:00Z');
  const daysFromNow = (n: number) => new Date(NOW.getTime() + n * DAY);

  const proLite = {
    id: 'plan_lite',
    key: PlanTier.PRO_LITE,
    name: 'Pro Lite',
    priceMonthly: 100000,
    limits: { profiles: 2 },
  };
  const proPlus = {
    id: 'plan_plus',
    key: PlanTier.PRO_PLUS,
    name: 'Pro Plus',
    priceMonthly: 150000,
    limits: { profiles: 5 },
  };
  const freePlan = {
    id: 'plan_free',
    key: PlanTier.FREE,
    name: 'Free',
    priceMonthly: 0,
    limits: { profiles: 1 },
  };

  let service: SubscriptionsService;
  let db: any;
  let notifications: any;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(NOW);
    db = {
      subscription: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve(data)),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      plan: {
        findUnique: jest.fn(({ where }) =>
          Promise.resolve(
            [freePlan, proLite, proPlus].find((p) => p.key === where.key) ??
              null,
          ),
        ),
      },
    };
    notifications = { dispatch: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: DatabaseService, useValue: db },
        { provide: NotificationDispatcher, useValue: notifications },
        {
          provide: SystemConfigService,
          useValue: {
            isPersonalSubscriptionEnabled: jest.fn().mockResolvedValue(true),
            isPersonalBypassed: jest.fn().mockResolvedValue(false),
          },
        },
      ],
    }).compile();
    service = module.get(SubscriptionsService);
  });

  afterEach(() => jest.useRealTimers());

  describe('getUserLimits after cancelling or missing a renewal', () => {
    const limitsFor = async (sub: object) => {
      db.subscription.findUnique.mockResolvedValue({ plan: proLite, ...sub });
      return (await service.getUserLimits('usr_1')).profiles;
    };

    it('keeps paid limits for a cancelled plan until the paid period ends', async () => {
      expect(
        await limitsFor({
          status: SubscriptionStatus.CANCELLED,
          currentPeriodEnd: daysFromNow(10),
        }),
      ).toBe(2);
    });

    it('drops a cancelled plan to Free limits once the paid period is over', async () => {
      expect(
        await limitsFor({
          status: SubscriptionStatus.CANCELLED,
          currentPeriodEnd: daysFromNow(-1),
        }),
      ).toBe(1);
    });

    it('keeps a cancelled trial until the trial ends', async () => {
      expect(
        await limitsFor({
          status: SubscriptionStatus.CANCELLED,
          currentPeriodEnd: null,
          trialEndDate: daysFromNow(5),
        }),
      ).toBe(2);
    });

    it('keeps paid limits during the past-due grace days, then Free limits', async () => {
      expect(
        await limitsFor({
          status: SubscriptionStatus.PAST_DUE,
          currentPeriodEnd: daysFromNow(-(PAST_DUE_GRACE_DAYS - 1)),
        }),
      ).toBe(2);
      expect(
        await limitsFor({
          status: SubscriptionStatus.PAST_DUE,
          currentPeriodEnd: daysFromNow(-(PAST_DUE_GRACE_DAYS + 1)),
        }),
      ).toBe(1);
    });

    it('gives Free limits to an expired plan', async () => {
      expect(
        await limitsFor({
          status: SubscriptionStatus.EXPIRED,
          currentPeriodEnd: daysFromNow(10),
        }),
      ).toBe(1);
    });
  });

  describe('checkoutBlockedReason', () => {
    const activeLite = (daysLeft: number) => ({
      plan: proLite,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: daysFromNow(daysLeft),
      trialEndDate: null,
    });

    it('refuses the same plan while more than the renewal window is left', () => {
      const reason = service.checkoutBlockedReason(
        activeLite(20),
        PlanTier.PRO_LITE,
      );
      expect(reason).toContain("You're already on Pro Lite until 2026-10-12");
      expect(reason).toContain('You can renew from 2026-10-05');
    });

    it('allows renewing the same plan inside the renewal window', () => {
      expect(
        service.checkoutBlockedReason(
          activeLite(RENEWAL_WINDOW_DAYS - 1),
          PlanTier.PRO_LITE,
        ),
      ).toBeNull();
    });

    it('allows a different plan at any time', () => {
      expect(
        service.checkoutBlockedReason(activeLite(20), PlanTier.PRO_PLUS),
      ).toBeNull();
    });

    it('allows resubscribing to a cancelled or past-due plan', () => {
      for (const status of [
        SubscriptionStatus.CANCELLED,
        SubscriptionStatus.PAST_DUE,
      ]) {
        expect(
          service.checkoutBlockedReason(
            { ...activeLite(20), status },
            PlanTier.PRO_LITE,
          ),
        ).toBeNull();
      }
    });

    it('turns the refusal into a 409 when starting a checkout', async () => {
      db.subscription.findUnique.mockResolvedValue({
        id: 'sub_1',
        ...activeLite(20),
      });
      await expect(
        service.assertCheckoutAllowed('usr_1', PlanTier.PRO_LITE),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('upgradePlan', () => {
    const existing = (plan: { id: string }, extra: object) => ({
      userId: 'usr_1',
      planId: plan.id,
      currentPeriodStart: daysFromNow(-25),
      ...extra,
    });

    it('adds a month to the current end when renewing the same plan early', async () => {
      db.subscription.findUnique.mockResolvedValue(
        existing(proLite, {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: daysFromNow(5),
        }),
      );
      const updated: any = await service.upgradePlan(
        'usr_1',
        PlanTier.PRO_LITE,
        'ref_1',
      );
      expect(updated.currentPeriodEnd).toEqual(
        new Date('2026-10-27T12:00:00Z'),
      );
      expect(updated.currentPeriodStart).toEqual(daysFromNow(-25));
      expect(updated.status).toBe(SubscriptionStatus.ACTIVE);
    });

    it('reactivates a cancelled plan from its current end and clears cancelledAt', async () => {
      db.subscription.findUnique.mockResolvedValue(
        existing(proLite, {
          status: SubscriptionStatus.CANCELLED,
          cancelledAt: daysFromNow(-2),
          currentPeriodEnd: daysFromNow(10),
        }),
      );
      const updated: any = await service.upgradePlan(
        'usr_1',
        PlanTier.PRO_LITE,
        'ref_2',
      );
      expect(updated.currentPeriodEnd).toEqual(
        new Date('2026-11-02T12:00:00Z'),
      );
      expect(updated.cancelledAt).toBeNull();
    });

    it('starts a fresh month today when switching to a different plan', async () => {
      db.subscription.findUnique.mockResolvedValue(
        existing(proLite, {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: daysFromNow(5),
        }),
      );
      const updated: any = await service.upgradePlan(
        'usr_1',
        PlanTier.PRO_PLUS,
        'ref_3',
      );
      expect(updated.currentPeriodStart).toEqual(NOW);
      expect(updated.currentPeriodEnd).toEqual(
        new Date('2026-10-22T12:00:00Z'),
      );
    });

    it('clamps to the last day of a shorter month', async () => {
      jest.setSystemTime(new Date('2027-01-31T12:00:00Z'));
      db.subscription.findUnique.mockResolvedValue(
        existing(freePlan, {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: null,
        }),
      );
      const updated: any = await service.upgradePlan(
        'usr_1',
        PlanTier.PRO_LITE,
        'ref_4',
      );
      expect(updated.currentPeriodEnd.toISOString().slice(0, 10)).toBe(
        '2027-02-28',
      );
    });
  });

  describe('cancelSubscription', () => {
    it('refuses to cancel the Free plan', async () => {
      db.subscription.findUnique.mockResolvedValue({
        userId: 'usr_1',
        plan: freePlan,
        status: SubscriptionStatus.ACTIVE,
      });
      await expect(service.cancelSubscription('usr_1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(db.subscription.update).not.toHaveBeenCalled();
    });

    it('is idempotent for an already-cancelled plan', async () => {
      const sub = {
        userId: 'usr_1',
        plan: proLite,
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: daysFromNow(-3),
      };
      db.subscription.findUnique.mockResolvedValue(sub);
      await expect(service.cancelSubscription('usr_1')).resolves.toBe(sub);
      expect(db.subscription.update).not.toHaveBeenCalled();
    });

    it('cancels an active paid plan', async () => {
      db.subscription.findUnique.mockResolvedValue({
        userId: 'usr_1',
        plan: proLite,
        status: SubscriptionStatus.ACTIVE,
      });
      const updated: any = await service.cancelSubscription('usr_1');
      expect(updated.status).toBe(SubscriptionStatus.CANCELLED);
      expect(updated.cancelledAt).toEqual(NOW);
    });
  });

  describe('processPaidExpiries', () => {
    const byStatus = (lists: Partial<Record<SubscriptionStatus, object[]>>) =>
      db.subscription.findMany.mockImplementation(({ where }) =>
        Promise.resolve(lists[where.status as SubscriptionStatus] ?? []),
      );

    it('marks an active paid plan past due when its month ends, and asks the user to renew', async () => {
      byStatus({
        [SubscriptionStatus.ACTIVE]: [
          {
            id: 'sub_a',
            userId: 'usr_a',
            plan: proLite,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodEnd: daysFromNow(-1),
          },
          {
            id: 'sub_f',
            userId: 'usr_f',
            plan: freePlan,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodEnd: daysFromNow(-1),
          },
        ],
      });

      await service.processPaidExpiries();

      expect(db.subscription.update).toHaveBeenCalledTimes(1);
      expect(db.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub_a' },
        data: { status: SubscriptionStatus.PAST_DUE },
      });
      expect(notifications.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'usr_a',
          type: 'SUBSCRIPTION_PAST_DUE',
          message: expect.stringContaining('Renew by 2026-09-24'),
        }),
      );
    });

    it('starts the grace days from now for a period that ended long before it was marked', async () => {
      byStatus({
        [SubscriptionStatus.ACTIVE]: [
          {
            id: 'sub_old',
            userId: 'usr_old',
            plan: proLite,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodEnd: daysFromNow(-10),
          },
        ],
      });

      await service.processPaidExpiries();

      expect(db.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub_old' },
        data: { status: SubscriptionStatus.PAST_DUE, currentPeriodEnd: NOW },
      });
      expect(notifications.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'usr_old',
          message: expect.stringContaining('Renew by 2026-09-25'),
        }),
      );
    });

    it('moves past-due plans whose grace is over, and cancelled plans whose period ended, to Free', async () => {
      byStatus({
        [SubscriptionStatus.PAST_DUE]: [{ id: 'sub_p' }],
        [SubscriptionStatus.CANCELLED]: [{ id: 'sub_c' }],
      });
      db.subscription.findUnique.mockImplementation(({ where }) =>
        Promise.resolve({
          id: where.id,
          userId: `usr_${where.id}`,
          plan: proLite,
        }),
      );

      await service.processPaidExpiries();

      const downgrades = db.subscription.update.mock.calls.map(
        (c: any[]) => c[0],
      );
      expect(downgrades).toEqual(
        expect.arrayContaining([
          {
            where: { id: 'sub_p' },
            data: { planId: 'plan_free', status: SubscriptionStatus.EXPIRED },
          },
          {
            where: { id: 'sub_c' },
            data: { planId: 'plan_free', status: SubscriptionStatus.EXPIRED },
          },
        ]),
      );
      const messages = notifications.dispatch.mock.calls.map(
        (c: any[]) => c[0],
      );
      expect(messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            userId: 'usr_sub_p',
            type: 'SUBSCRIPTION_CANCELLED',
            message: expect.stringContaining(
              'did not receive a renewal payment',
            ),
          }),
          expect.objectContaining({
            userId: 'usr_sub_c',
            type: 'SUBSCRIPTION_CANCELLED',
            message: expect.stringContaining('The period you paid for is over'),
          }),
        ]),
      );
    });

    it('queries past-due plans by the grace cutoff, and never downgrades cancelled Free rows', async () => {
      await service.processPaidExpiries();

      const pastDueQuery = db.subscription.findMany.mock.calls.find(
        (c: any[]) => c[0].where.status === SubscriptionStatus.PAST_DUE,
      )[0];
      expect(pastDueQuery.where.currentPeriodEnd.lte).toEqual(
        daysFromNow(-PAST_DUE_GRACE_DAYS),
      );
      const cancelledQuery = db.subscription.findMany.mock.calls.find(
        (c: any[]) => c[0].where.status === SubscriptionStatus.CANCELLED,
      )[0];
      expect(cancelledQuery.where.plan).toEqual({
        key: { not: PlanTier.FREE },
      });
      expect(db.subscription.updateMany).toHaveBeenCalledWith({
        where: {
          status: SubscriptionStatus.CANCELLED,
          plan: { key: PlanTier.FREE },
        },
        data: { status: SubscriptionStatus.ACTIVE, cancelledAt: null },
      });
    });
  });

  describe('buildSubscriptionResponse', () => {
    it('reports access, its end and when renewing opens for an active paid plan', () => {
      const res = service.buildSubscriptionResponse({
        plan: proLite,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: daysFromNow(20),
        trialEndDate: null,
      } as any);
      expect(res.hasPlanAccess).toBe(true);
      expect(res.accessEndsAt).toEqual(daysFromNow(20));
      expect(res.canRenew).toBe(false);
      expect(res.renewalOpensAt).toEqual(daysFromNow(20 - RENEWAL_WINDOW_DAYS));
    });

    it('lets a cancelled user resubscribe while keeping access until the period ends', () => {
      const res = service.buildSubscriptionResponse({
        plan: proLite,
        status: SubscriptionStatus.CANCELLED,
        currentPeriodEnd: daysFromNow(10),
        trialEndDate: null,
      } as any);
      expect(res.hasPlanAccess).toBe(true);
      expect(res.accessEndsAt).toEqual(daysFromNow(10));
      expect(res.canRenew).toBe(true);
      expect(res.renewalOpensAt).toBeNull();
    });

    it('never offers renewal on the Free plan', () => {
      const res = service.buildSubscriptionResponse({
        plan: freePlan,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: null,
        trialEndDate: null,
      } as any);
      expect(res.canRenew).toBe(false);
      expect(res.accessEndsAt).toBeNull();
    });
  });
});
