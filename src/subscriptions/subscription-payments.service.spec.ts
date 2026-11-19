import { PlanTier, SubscriptionStatus } from '../generated/prisma/client';
import { SubscriptionPaymentsService } from './subscription-payments.service';
import {
  SubscriptionsService,
  TRIAL_START_KOBO,
} from './subscriptions.service';
import { WebhookResult } from './gateways/payment-gateway.interface';

describe('SubscriptionPaymentsService', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const NOW = new Date('2026-09-22T12:00:00Z');
  const daysFromNow = (n: number) => new Date(NOW.getTime() + n * DAY);

  const plans = {
    plan_free: {
      id: 'plan_free',
      key: PlanTier.FREE,
      name: 'Free',
      priceMonthly: 0,
    },
    plan_lite: {
      id: 'plan_lite',
      key: PlanTier.PRO_LITE,
      name: 'Pro Lite',
      priceMonthly: 100000,
    },
    plan_plus: {
      id: 'plan_plus',
      key: PlanTier.PRO_PLUS,
      name: 'Pro Plus',
      priceMonthly: 150000,
    },
  };
  const card = {
    id: 'card_new',
    last4: '4081',
    brand: 'visa',
    bank: null,
    expMonth: '12',
    expYear: '2030',
  };

  // A one-row database: enough to run the real activation and upgradePlan.
  let state: any;
  let records: any[];
  let db: any;
  let wallet: { removeSavedCard: jest.Mock; revokeMandate: jest.Mock };
  let notifications: { dispatch: jest.Mock };
  let subscriptions: SubscriptionsService;
  let service: SubscriptionPaymentsService;

  const withPlan = () => ({ ...state, plan: plans[state.planId] });

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    records = [];
    state = {
      id: 'sub_1',
      userId: 'usr_1',
      planId: 'plan_free',
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      trialEndDate: null,
      trialUsed: false,
      autoRenew: false,
      paymentMethod: null,
      savedCardId: null,
      savedCardLabel: null,
      walletMandateId: null,
      renewalAttempts: 0,
    };
    db = {
      $transaction: jest.fn((fn) => fn(db)),
      $queryRaw: jest.fn().mockResolvedValue([]),
      plan: {
        findUnique: jest.fn(({ where }) =>
          Promise.resolve(
            Object.values(plans).find((p) => p.key === where.key) ?? null,
          ),
        ),
      },
      subscription: {
        findUnique: jest.fn(({ include }) =>
          Promise.resolve(state && (include?.plan ? withPlan() : { ...state })),
        ),
        update: jest.fn(({ data }) => {
          state = { ...state, ...data };
          return Promise.resolve({ ...state });
        }),
      },
      paymentRecord: {
        findUnique: jest.fn(({ where }) =>
          Promise.resolve(
            records.find((r) => r.gatewayRef === where.gatewayRef) ?? null,
          ),
        ),
        count: jest.fn(() =>
          Promise.resolve(records.filter((r) => r.status === 'success').length),
        ),
        create: jest.fn(({ data }) => {
          if (records.some((r) => r.gatewayRef === data.gatewayRef)) {
            return Promise.reject(
              Object.assign(new Error('Unique constraint failed'), {
                code: 'P2002',
                meta: { target: ['gatewayRef'] },
              }),
            );
          }
          records.push(data);
          return Promise.resolve(data);
        }),
      },
    };
    wallet = {
      removeSavedCard: jest.fn().mockResolvedValue(undefined),
      revokeMandate: jest.fn().mockResolvedValue(undefined),
    };
    notifications = { dispatch: jest.fn().mockResolvedValue(undefined) };
    subscriptions = new SubscriptionsService(
      db,
      notifications as any,
      {} as any,
    );
    service = new SubscriptionPaymentsService(
      subscriptions,
      db,
      notifications as any,
      wallet as any,
    );
  });

  afterEach(() => jest.useRealTimers());

  const pay = (result: Partial<WebhookResult>) =>
    service.activateFromPayment(
      {
        success: true,
        userId: 'usr_1',
        planKey: PlanTier.PRO_LITE,
        reference: 'ref_1',
        amountKobo: 100000,
        ...result,
      } as WebhookResult,
      'Test',
    );

  describe('starting a trial', () => {
    const trial = {
      checkoutKind: 'trial' as const,
      amountKobo: TRIAL_START_KOBO,
      autoRenew: true,
      paymentMethod: 'CARD' as const,
      savedCard: card,
    };

    it('starts the trial on the ₦50 check and keeps the card to charge at its end', async () => {
      await expect(pay(trial)).resolves.toMatchObject({ status: 'success' });

      expect(state).toMatchObject({
        planId: 'plan_lite',
        status: SubscriptionStatus.TRIALING,
        trialUsed: true,
        trialEndDate: new Date('2027-03-22T12:00:00Z'),
        currentPeriodEnd: null,
        autoRenew: true,
        paymentMethod: 'CARD',
        savedCardId: 'card_new',
        savedCardLabel: 'visa •••• 4081',
      });
      expect(records).toEqual([
        expect.objectContaining({
          amount: TRIAL_START_KOBO,
          gatewayRef: 'ref_1',
        }),
      ]);
      expect(notifications.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Your free trial has started',
          message: expect.stringContaining("We'll charge ₦1,000 on 2027-03-22"),
        }),
      );
    });

    it('refuses a second trial, for a refund', async () => {
      state.trialUsed = true;
      await expect(pay(trial)).resolves.toMatchObject({ status: 'rejected' });
      expect(state.status).toBe(SubscriptionStatus.ACTIVE);
      expect(records).toEqual([]);
    });

    it('refuses a trial for someone who has paid before', async () => {
      records.push({ gatewayRef: 'ref_old', status: 'success' });
      await expect(pay(trial)).resolves.toMatchObject({ status: 'rejected' });
      expect(state.planId).toBe('plan_free');
    });

    it('refuses less than the card check', async () => {
      await expect(pay({ ...trial, amountKobo: 100 })).resolves.toMatchObject({
        status: 'rejected',
      });
      expect(db.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('automatic renewals', () => {
    const periodEnd = daysFromNow(1);

    beforeEach(() => {
      Object.assign(state, {
        planId: 'plan_lite',
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: daysFromNow(-29),
        currentPeriodEnd: periodEnd,
        autoRenew: true,
        paymentMethod: 'CARD',
        savedCardId: 'card_1',
        savedCardLabel: 'visa •••• 1111',
        renewalAttempts: 1,
        lastRenewalAttemptAt: NOW,
      });
    });

    const renewal = {
      checkoutKind: 'renewal' as const,
      pricedPeriodEnd: periodEnd.toISOString(),
      paymentMethod: 'CARD' as const,
    };

    it('adds a month from the renewal date and keeps the card', async () => {
      await expect(pay(renewal)).resolves.toMatchObject({ status: 'success' });

      expect(state).toMatchObject({
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: periodEnd,
        currentPeriodEnd: new Date('2026-10-23T12:00:00Z'),
        renewalAttempts: 0,
        lastRenewalAttemptAt: null,
        savedCardId: 'card_1',
        autoRenew: true,
      });
      expect(wallet.removeSavedCard).not.toHaveBeenCalled();
      expect(notifications.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Pro Lite renewed' }),
      );
    });

    it('renews a trial into its first paid month', async () => {
      Object.assign(state, {
        status: SubscriptionStatus.TRIALING,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        trialEndDate: periodEnd,
      });
      await expect(pay(renewal)).resolves.toMatchObject({ status: 'success' });
      expect(state).toMatchObject({
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: periodEnd,
        currentPeriodEnd: new Date('2026-10-23T12:00:00Z'),
      });
    });

    it('refuses a renewal for a date that has since moved, for a refund', async () => {
      state.currentPeriodEnd = daysFromNow(31);
      await expect(pay(renewal)).resolves.toMatchObject({ status: 'rejected' });
      expect(records).toEqual([]);
    });

    it('refuses a renewal once cancelled', async () => {
      state.status = SubscriptionStatus.CANCELLED;
      await expect(pay(renewal)).resolves.toMatchObject({ status: 'rejected' });
    });

    it('applies the same charge once, however many times it is reported', async () => {
      await pay(renewal);
      // The charge's own webhook arrives after the job already applied it.
      await expect(pay(renewal)).resolves.toMatchObject({
        status: 'already_processed',
      });
      expect(records).toHaveLength(1);
      expect(state.currentPeriodEnd).toEqual(new Date('2026-10-23T12:00:00Z'));
    });

    it('refuses less than the monthly price', async () => {
      await expect(
        pay({ ...renewal, amountKobo: 50000 }),
      ).resolves.toMatchObject({
        status: 'rejected',
      });
    });
  });

  describe('how a payment sets up automatic renewal', () => {
    beforeEach(() => {
      Object.assign(state, {
        autoRenew: true,
        paymentMethod: 'CARD',
        savedCardId: 'card_old',
        savedCardLabel: 'visa •••• 1111',
      });
    });

    it('switches to the wallet permission granted with a wallet payment, releasing the old card', async () => {
      await pay({
        paymentMethod: 'WALLET',
        autoRenew: true,
        walletMandateId: 'mandate_1',
      });
      expect(state).toMatchObject({
        autoRenew: true,
        paymentMethod: 'WALLET',
        walletMandateId: 'mandate_1',
        savedCardId: null,
        savedCardLabel: null,
      });
      expect(wallet.removeSavedCard).toHaveBeenCalledWith('card_old', 'usr_1');
      expect(wallet.revokeMandate).not.toHaveBeenCalled();
    });

    it('switches to a newly saved card, releasing the old one', async () => {
      await pay({ paymentMethod: 'CARD', autoRenew: true, savedCard: card });
      expect(state.savedCardId).toBe('card_new');
      expect(wallet.removeSavedCard).toHaveBeenCalledWith('card_old', 'usr_1');
    });

    it('keeps the card if the same one is saved again', async () => {
      state.savedCardId = 'card_new';
      await pay({ paymentMethod: 'CARD', autoRenew: true, savedCard: card });
      expect(wallet.removeSavedCard).not.toHaveBeenCalled();
    });

    it('stops renewing, and releases the card and permission, when the user says no', async () => {
      state.walletMandateId = 'mandate_old';
      await pay({ paymentMethod: 'CARD', autoRenew: false });
      expect(state).toMatchObject({
        autoRenew: false,
        paymentMethod: null,
        savedCardId: null,
        walletMandateId: null,
      });
      expect(wallet.removeSavedCard).toHaveBeenCalledWith('card_old', 'usr_1');
      expect(wallet.revokeMandate).toHaveBeenCalledWith('mandate_old', 'usr_1');
    });

    it('leaves renewal as it was when the card could not be saved', async () => {
      await pay({ paymentMethod: 'CARD', autoRenew: true });
      expect(state.savedCardId).toBe('card_old');
      expect(wallet.removeSavedCard).not.toHaveBeenCalled();
    });

    it('still succeeds if releasing the old card fails', async () => {
      wallet.removeSavedCard.mockRejectedValue(new Error('wallet-nest down'));
      await expect(
        pay({
          paymentMethod: 'WALLET',
          autoRenew: true,
          walletMandateId: 'm_1',
        }),
      ).resolves.toMatchObject({ status: 'success' });
    });
  });

  describe('stopAutoRenew', () => {
    it('forgets the card and permission and releases both', async () => {
      Object.assign(state, {
        autoRenew: true,
        paymentMethod: 'WALLET',
        savedCardId: 'card_1',
        walletMandateId: 'mandate_1',
      });
      await service.stopAutoRenew('usr_1');
      expect(state).toMatchObject({
        autoRenew: false,
        paymentMethod: null,
        savedCardId: null,
        walletMandateId: null,
      });
      expect(wallet.removeSavedCard).toHaveBeenCalledWith('card_1', 'usr_1');
      expect(wallet.revokeMandate).toHaveBeenCalledWith('mandate_1', 'usr_1');
    });

    it('does nothing for a user with no subscription', async () => {
      state = null;
      await service.stopAutoRenew('usr_1');
      expect(db.subscription.update).not.toHaveBeenCalled();
    });
  });
});
