import {
  BadRequestException,
  BadGatewayException,
  NotFoundException,
} from '@nestjs/common';
import { PlanTier, SubscriptionStatus } from '../generated/prisma/client';
import { SubscriptionRenewalService } from './subscription-renewal.service';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionRenewalService', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const NOW = new Date('2026-09-30T00:00:00Z');
  const daysFromNow = (n: number) => new Date(NOW.getTime() + n * DAY);
  const proLite = {
    id: 'plan_lite',
    key: PlanTier.PRO_LITE,
    name: 'Pro Lite',
    priceMonthly: 100000,
  };

  let db: any;
  let subscriptions: SubscriptionsService;
  let payments: { activateFromPayment: jest.Mock; stopAutoRenew: jest.Mock };
  let wallet: { chargeMandate: jest.Mock; chargeSavedCard: jest.Mock };
  let notifications: { dispatch: jest.Mock };
  let systemConfig: { isPersonalSubscriptionEnabled: jest.Mock };
  let service: SubscriptionRenewalService;

  const sub = (extra: object = {}): any => ({
    id: 'sub_1',
    userId: 'usr_1',
    plan: proLite,
    status: SubscriptionStatus.ACTIVE,
    currentPeriodEnd: daysFromNow(1),
    trialEndDate: null,
    autoRenew: true,
    paymentMethod: 'CARD',
    savedCardId: 'card_1',
    savedCardLabel: 'visa •••• 4081',
    walletMandateId: null,
    renewalAttempts: 0,
    lastRenewalAttemptAt: null,
    renewalReminderFor: null,
    ...extra,
  });
  const walletSub = (extra: object = {}) =>
    sub({
      paymentMethod: 'WALLET',
      savedCardId: null,
      walletMandateId: 'mandate_1',
      ...extra,
    });

  beforeEach(() => {
    db = {
      subscription: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    notifications = { dispatch: jest.fn().mockResolvedValue(undefined) };
    systemConfig = {
      isPersonalSubscriptionEnabled: jest.fn().mockResolvedValue(true),
    };
    subscriptions = new SubscriptionsService(
      db,
      notifications as any,
      systemConfig as any,
    );
    payments = {
      activateFromPayment: jest.fn().mockResolvedValue({ status: 'success' }),
      stopAutoRenew: jest.fn().mockResolvedValue(undefined),
    };
    wallet = {
      chargeMandate: jest.fn(({ reference }) =>
        Promise.resolve({ status: 'success', reference, reason: null }),
      ),
      chargeSavedCard: jest.fn((_card, { reference }) =>
        Promise.resolve({ status: 'success', reference, reason: null }),
      ),
    };
    service = new SubscriptionRenewalService(
      db,
      subscriptions,
      payments as any,
      wallet as any,
      notifications as any,
      systemConfig as any,
    );
  });

  describe('renew', () => {
    it('charges the wallet permission under one reference per renewal date', async () => {
      await expect(service.renew(walletSub(), NOW)).resolves.toBe(true);

      expect(wallet.chargeMandate).toHaveBeenCalledWith({
        mandateId: 'mandate_1',
        userId: 'usr_1',
        amountKobo: 100000,
        reference: 'SUBR_sub_1_20261001',
        description: 'Connect Pro Lite plan renewal',
        metadata: {
          userId: 'usr_1',
          planKey: PlanTier.PRO_LITE,
          checkoutKind: 'renewal',
          anchor: daysFromNow(1).toISOString(),
        },
      });
      expect(payments.activateFromPayment).toHaveBeenCalledWith(
        {
          success: true,
          userId: 'usr_1',
          planKey: PlanTier.PRO_LITE,
          reference: 'SUBR_sub_1_20261001',
          amountKobo: 100000,
          checkoutKind: 'renewal',
          pricedPeriodEnd: daysFromNow(1).toISOString(),
          paymentMethod: 'WALLET',
        },
        'Wallet renewal',
      );
    });

    it('charges the saved card under a new reference each attempt', async () => {
      await service.renew(sub({ renewalAttempts: 1 }), NOW);
      expect(wallet.chargeSavedCard).toHaveBeenCalledWith('card_1', {
        userId: 'usr_1',
        amountKobo: 100000,
        reference: 'SUBR_sub_1_20261001_2',
        metadata: expect.objectContaining({ checkoutKind: 'renewal' }),
      });
      expect(db.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub_1' },
        data: { renewalAttempts: 2, lastRenewalAttemptAt: NOW },
      });
    });

    it('renews a trial from its end date', async () => {
      await service.renew(
        sub({
          status: SubscriptionStatus.TRIALING,
          currentPeriodEnd: null,
          trialEndDate: daysFromNow(0.5),
        }),
        NOW,
      );
      expect(payments.activateFromPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          pricedPeriodEnd: daysFromNow(0.5).toISOString(),
        }),
        'Card renewal',
      );
    });

    it('counts a charge its own webhook already applied as renewed', async () => {
      payments.activateFromPayment.mockResolvedValue({
        status: 'already_processed',
      });
      await expect(service.renew(sub(), NOW)).resolves.toBe(true);
    });

    it('tells the user about the first decline only, and keeps trying', async () => {
      wallet.chargeSavedCard.mockResolvedValue({
        status: 'failed',
        reference: 'r',
        reason: 'Insufficient Funds',
      });
      await expect(service.renew(sub(), NOW)).resolves.toBe(false);
      expect(notifications.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SUBSCRIPTION_RENEWAL_FAILED',
          message: expect.stringContaining('visa •••• 4081'),
        }),
      );
      expect(payments.activateFromPayment).not.toHaveBeenCalled();

      notifications.dispatch.mockClear();
      await service.renew(
        sub({ renewalAttempts: 1, lastRenewalAttemptAt: daysFromNow(-1) }),
        NOW,
      );
      expect(wallet.chargeSavedCard).toHaveBeenCalledTimes(2);
      expect(notifications.dispatch).not.toHaveBeenCalled();
    });

    it('treats a refusal from wallet-nest as a decline, not a crash', async () => {
      wallet.chargeMandate.mockRejectedValue(
        new BadRequestException(
          'Amount is more than the user allowed for automatic payments',
        ),
      );
      await expect(service.renew(walletSub(), NOW)).resolves.toBe(false);
      expect(notifications.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SUBSCRIPTION_RENEWAL_FAILED',
          message: expect.stringContaining('more than the user allowed'),
        }),
      );
    });

    it('rethrows when wallet-nest itself fails, for the next run to retry', async () => {
      wallet.chargeSavedCard.mockRejectedValue(new BadGatewayException());
      await expect(service.renew(sub(), NOW)).rejects.toBeInstanceOf(
        BadGatewayException,
      );
      expect(notifications.dispatch).not.toHaveBeenCalled();
    });

    it('waits for the webhook on a charge Paystack is still deciding', async () => {
      wallet.chargeSavedCard.mockResolvedValue({
        status: 'pending',
        reference: 'r',
        reason: null,
      });
      await expect(service.renew(sub(), NOW)).resolves.toBe(false);
      expect(notifications.dispatch).not.toHaveBeenCalled();
      expect(payments.activateFromPayment).not.toHaveBeenCalled();
    });

    it('turns renewal off when the card or permission is gone', async () => {
      wallet.chargeMandate.mockRejectedValue(new NotFoundException());
      await expect(service.renew(walletSub(), NOW)).resolves.toBe(false);
      expect(payments.stopAutoRenew).toHaveBeenCalledWith('usr_1');
      expect(notifications.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Automatic renewal of Pro Lite is off',
          message: expect.stringContaining('wallet permission'),
        }),
      );
    });

    it('skips a subscription tried in the last 20 hours', async () => {
      await expect(
        service.renew(
          sub({ lastRenewalAttemptAt: new Date(NOW.getTime() - 19 * 3600e3) }),
          NOW,
        ),
      ).resolves.toBe(false);
      expect(wallet.chargeSavedCard).not.toHaveBeenCalled();
    });

    it('leaves a past-due plan whose grace is over for the expiry step', async () => {
      await service.renew(
        sub({
          status: SubscriptionStatus.PAST_DUE,
          currentPeriodEnd: daysFromNow(-4),
        }),
        NOW,
      );
      expect(wallet.chargeSavedCard).not.toHaveBeenCalled();
    });

    it('keeps charging a past-due plan during its grace days', async () => {
      await expect(
        service.renew(
          sub({
            status: SubscriptionStatus.PAST_DUE,
            currentPeriodEnd: daysFromNow(-2),
            renewalAttempts: 1,
            lastRenewalAttemptAt: daysFromNow(-1),
          }),
          NOW,
        ),
      ).resolves.toBe(true);
      expect(wallet.chargeSavedCard).toHaveBeenCalledWith(
        'card_1',
        expect.objectContaining({ reference: 'SUBR_sub_1_20260928_2' }),
      );
    });

    it('charges nothing without the card or permission for the chosen method', async () => {
      await expect(
        service.renew(sub({ savedCardId: null }), NOW),
      ).resolves.toBe(false);
      await expect(service.renew(sub({ autoRenew: false }), NOW)).resolves.toBe(
        false,
      );
      expect(wallet.chargeSavedCard).not.toHaveBeenCalled();
      expect(db.subscription.update).not.toHaveBeenCalled();
    });
  });

  describe('sendRenewalReminders', () => {
    it('reminds once per renewal date, naming the amount, card and date', async () => {
      db.subscription.findMany.mockResolvedValue([
        sub({ id: 'sub_a', currentPeriodEnd: daysFromNow(3) }),
        sub({
          id: 'sub_b',
          currentPeriodEnd: daysFromNow(2),
          renewalReminderFor: daysFromNow(2),
        }),
        walletSub({ id: 'sub_c', currentPeriodEnd: daysFromNow(2) }),
      ]);

      await expect(service.sendRenewalReminders(NOW)).resolves.toBe(2);

      expect(notifications.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SUBSCRIPTION_RENEWAL_REMINDER',
          title: 'Pro Lite renews on 2026-10-03',
          message: expect.stringContaining(
            '₦1,000 to visa •••• 4081 on 2026-10-03',
          ),
        }),
      );
      expect(notifications.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('your Fiscus wallet'),
        }),
      );
      expect(db.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub_a' },
        data: { renewalReminderFor: daysFromNow(3) },
      });
      expect(db.subscription.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'sub_b' } }),
      );
    });
  });

  describe('runNightly', () => {
    it('charges renewals before it ends trials and periods', async () => {
      const order: string[] = [];
      jest
        .spyOn(service, 'sendRenewalReminders')
        .mockImplementation(async () => (order.push('remind'), 0));
      jest
        .spyOn(service, 'chargeDueRenewals')
        .mockImplementation(async () => void order.push('charge'));
      jest
        .spyOn(subscriptions, 'processTrialExpiries')
        .mockImplementation(async () => void order.push('trials'));
      jest
        .spyOn(subscriptions, 'processPaidExpiries')
        .mockImplementation(async () => void order.push('periods'));

      await service.runNightly();
      expect(order).toEqual(['remind', 'charge', 'trials', 'periods']);
    });

    it('does nothing while subscriptions are switched off', async () => {
      systemConfig.isPersonalSubscriptionEnabled.mockResolvedValue(false);
      const charge = jest.spyOn(service, 'chargeDueRenewals');
      await service.runNightly();
      expect(charge).not.toHaveBeenCalled();
    });
  });

  describe('chargeDueRenewals', () => {
    it('keeps going past a subscription whose charge crashes', async () => {
      db.subscription.findMany.mockResolvedValue([
        sub({ id: 'sub_a' }),
        sub({ id: 'sub_b', savedCardId: 'card_2' }),
      ]);
      wallet.chargeSavedCard.mockRejectedValueOnce(new BadGatewayException());
      await service.chargeDueRenewals(NOW);
      expect(wallet.chargeSavedCard).toHaveBeenCalledTimes(2);
      expect(payments.activateFromPayment).toHaveBeenCalledTimes(1);
    });
  });
});
