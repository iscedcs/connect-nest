import { BadRequestException, ConflictException } from '@nestjs/common';
import { PlanTier, SubscriptionStatus } from '../generated/prisma/client';
import { SubscriptionsController } from './subscriptions.controller';
import {
  SubscriptionsService,
  TRIAL_START_KOBO,
} from './subscriptions.service';

describe('SubscriptionsController (checkout)', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const NOW = new Date('2026-09-22T12:00:00Z');
  const daysFromNow = (n: number) => new Date(NOW.getTime() + n * DAY);
  const plans = {
    [PlanTier.FREE]: {
      id: 'plan_free',
      key: PlanTier.FREE,
      name: 'Free',
      priceMonthly: 0,
      isActive: true,
    },
    [PlanTier.PRO_LITE]: {
      id: 'plan_lite',
      key: PlanTier.PRO_LITE,
      name: 'Pro Lite',
      priceMonthly: 100000,
      isActive: true,
    },
    [PlanTier.PRO_PLUS]: {
      id: 'plan_plus',
      key: PlanTier.PRO_PLUS,
      name: 'Pro Plus',
      priceMonthly: 150000,
      isActive: true,
    },
  };
  const req = { user: { id: 'usr_1', email: 'user@example.com' } };

  let subscriptions: SubscriptionsService;
  let provider: { providerName: string; initiateCheckout: jest.Mock };
  let wallet: { createWalletPayment: jest.Mock };
  let payments: { stopAutoRenew: jest.Mock };
  let controller: SubscriptionsController;
  let current: any;
  let trialEligible: boolean;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    current = {
      id: 'sub_1',
      plan: plans[PlanTier.FREE],
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: null,
      trialEndDate: null,
    };
    trialEligible = false;

    subscriptions = new SubscriptionsService({} as any, {} as any, {} as any);
    jest
      .spyOn(subscriptions, 'getPlanByKey')
      .mockImplementation(async (key) => plans[key] as any);
    jest
      .spyOn(subscriptions, 'getActiveSubscription')
      .mockImplementation(async () => current);
    jest
      .spyOn(subscriptions, 'isTrialEligible')
      .mockImplementation(async () => trialEligible);
    jest.spyOn(subscriptions, 'cancelSubscription').mockResolvedValue({
      status: SubscriptionStatus.CANCELLED,
      cancelledAt: NOW,
    } as any);

    provider = {
      providerName: 'PAYSTACK',
      initiateCheckout: jest.fn().mockResolvedValue({
        checkoutUrl: 'https://checkout.paystack.com/x',
        reference: 'SUB_1',
      }),
    };
    wallet = {
      createWalletPayment: jest.fn().mockResolvedValue({
        id: 'sp_1',
        amountKobo: 0,
        balanceSufficient: true,
      }),
    };
    payments = { stopAutoRenew: jest.fn().mockResolvedValue(undefined) };

    controller = new SubscriptionsController(
      subscriptions,
      { getProvider: jest.fn().mockReturnValue(provider) } as any,
      {
        isPersonalSubscriptionEnabled: jest.fn().mockResolvedValue(true),
      } as any,
      {} as any,
      payments as any,
      wallet as any,
    );
  });

  afterEach(() => jest.useRealTimers());

  it('starts a trial from the wallet with a permission to charge the first month when it ends', async () => {
    trialEligible = true;
    const res = await controller.initiatePayment(req, {
      planKey: PlanTier.PRO_LITE,
      method: 'WALLET',
      autoRenew: false, // a trial always renews
    });

    expect(wallet.createWalletPayment).toHaveBeenCalledWith({
      userId: 'usr_1',
      amountKobo: TRIAL_START_KOBO,
      reference: expect.stringMatching(/^SUBW_PRO_LITE_usr_1_\d+$/),
      description: 'Connect Pro Lite trial start',
      metadata: {
        userId: 'usr_1',
        planKey: PlanTier.PRO_LITE,
        checkoutKind: 'trial',
        autoRenew: true,
      },
      mandateMaxAmountKobo: 100000,
    });
    expect(res.data).toMatchObject({
      method: 'WALLET',
      walletPaymentId: 'sp_1',
      kind: 'trial',
      amountKobo: TRIAL_START_KOBO,
      autoRenew: true,
      renewsAt: new Date('2027-03-22T12:00:00Z'),
    });
    expect(provider.initiateCheckout).not.toHaveBeenCalled();
  });

  it('asks wallet-nest to keep the card when renewing automatically, the default', async () => {
    await controller.initiatePayment(req, { planKey: PlanTier.PRO_LITE });
    expect(provider.initiateCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        amountKobo: 100000,
        saveCard: true,
        metadata: { checkoutKind: 'full', autoRenew: true },
      }),
    );
  });

  it('keeps no card, and grants no wallet permission, when the user opts out', async () => {
    await controller.initiatePayment(req, {
      planKey: PlanTier.PRO_LITE,
      autoRenew: false,
    });
    expect(provider.initiateCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ saveCard: false }),
    );

    await controller.initiatePayment(req, {
      planKey: PlanTier.PRO_LITE,
      method: 'WALLET',
      autoRenew: false,
    });
    expect(wallet.createWalletPayment.mock.calls[0][0]).not.toHaveProperty(
      'mandateMaxAmountKobo',
    );
  });

  it('prices a mid-cycle upgrade paid from the wallet, carrying what activation re-checks', async () => {
    current = {
      ...current,
      plan: plans[PlanTier.PRO_LITE],
      currentPeriodEnd: daysFromNow(15),
    };
    await controller.initiatePayment(req, {
      planKey: PlanTier.PRO_PLUS,
      method: 'WALLET',
    });
    const created = wallet.createWalletPayment.mock.calls[0][0];
    expect(created.amountKobo).toBeLessThan(150000);
    expect(created.metadata).toMatchObject({
      checkoutKind: 'prorated_upgrade',
      fromPlanKey: PlanTier.PRO_LITE,
      renewsAt: daysFromNow(15).toISOString(),
    });
    // Renewals charge the new plan's full price.
    expect(created.mandateMaxAmountKobo).toBe(150000);
  });

  it('only takes trials and upgrades through Paystack', async () => {
    trialEligible = true;
    provider.providerName = 'PAYDESTAL';
    await expect(
      controller.initiatePayment(req, { planKey: PlanTier.PRO_LITE }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a double payment before creating anything', async () => {
    current = {
      ...current,
      plan: plans[PlanTier.PRO_LITE],
      currentPeriodEnd: daysFromNow(20),
    };
    await expect(
      controller.initiatePayment(req, {
        planKey: PlanTier.PRO_LITE,
        method: 'WALLET',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(wallet.createWalletPayment).not.toHaveBeenCalled();
  });

  it('stops automatic renewal when the user cancels', async () => {
    await controller.cancelSubscription(req);
    expect(payments.stopAutoRenew).toHaveBeenCalledWith('usr_1');
  });

  it('reports trial eligibility on /me', async () => {
    trialEligible = true;
    const res = await controller.getMySubscription(req);
    expect(res.data.trialEligible).toBe(true);
  });
});
