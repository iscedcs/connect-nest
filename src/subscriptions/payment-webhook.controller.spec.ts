import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PaymentWebhookController } from './payment-webhook.controller';
import { PlanTier } from '../generated/prisma/client';

describe('PaymentWebhookController', () => {
  let controller: PaymentWebhookController;
  let mockGatewayFactory: any;
  let mockSubscriptionsService: any;
  let mockDb: any;
  let mockNotifications: any;
  let mockPaystackProvider: any;
  let mockTx: any;

  const REFERENCE = 'SUB_PRO_LITE_usr_test_123_1720000000';

  /** A webhook request as express delivers it, with the raw bytes the gateway signed. */
  const buildReq = (body: any) =>
    ({ body, rawBody: Buffer.from(JSON.stringify(body)) }) as any;

  const validBody = {
    event: 'charge.success',
    data: {
      reference: REFERENCE,
      amount: 100000,
      metadata: { userId: 'usr_test_123', planKey: PlanTier.PRO_LITE },
    },
  };

  beforeEach(() => {
    mockPaystackProvider = {
      verifyWebhookSignature: jest.fn().mockReturnValue(true),
      handleWebhookEvent: jest.fn().mockResolvedValue({
        success: true,
        userId: 'usr_test_123',
        planKey: PlanTier.PRO_LITE,
        reference: REFERENCE,
        amountKobo: 100000,
        gatewayCustomerId: 'CUST_123',
      }),
    };

    mockGatewayFactory = {
      getProvider: jest.fn().mockReturnValue(mockPaystackProvider),
    };

    mockSubscriptionsService = {
      upgradePlan: jest.fn().mockResolvedValue({
        id: 'sub_123',
        userId: 'usr_test_123',
        planId: 'plan_pro_lite',
      }),
    };

    mockTx = {
      paymentRecord: { create: jest.fn().mockResolvedValue({ id: 'pr_123' }) },
    };

    mockDb = {
      plan: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'plan_pro_lite',
          key: PlanTier.PRO_LITE,
          priceMonthly: 100000,
        }),
      },
      $transaction: jest.fn().mockImplementation((fn: any) => fn(mockTx)),
    };

    mockNotifications = {
      dispatch: jest.fn().mockResolvedValue(true),
    };

    controller = new PaymentWebhookController(
      mockGatewayFactory,
      mockSubscriptionsService,
      mockDb,
      mockNotifications,
    );
  });

  describe('handlePaystackWebhook', () => {
    it('should process valid webhook, upgrade subscription, and record payment', async () => {
      const response = await controller.handlePaystackWebhook(
        buildReq(validBody),
        'valid_signature',
      );

      expect(response).toEqual({
        status: 'success',
        userId: 'usr_test_123',
        planKey: PlanTier.PRO_LITE,
      });
      expect(mockSubscriptionsService.upgradePlan).toHaveBeenCalledWith(
        'usr_test_123',
        PlanTier.PRO_LITE,
        REFERENCE,
        mockTx,
      );
      expect(mockTx.paymentRecord.create).toHaveBeenCalled();
      expect(mockNotifications.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'usr_test_123',
          type: 'SUBSCRIPTION_ACTIVATED',
        }),
      );
    });

    // Regression: the guard was `if (signature && !verify(...))`, so omitting the
    // header skipped verification entirely and granted a free upgrade on an
    // unauthenticated public route.
    it('should reject a webhook sent with no signature header', async () => {
      await expect(
        controller.handlePaystackWebhook(buildReq(validBody), undefined as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(mockPaystackProvider.handleWebhookEvent).not.toHaveBeenCalled();
      expect(mockSubscriptionsService.upgradePlan).not.toHaveBeenCalled();
    });

    it('should reject a webhook whose signature does not verify', async () => {
      mockPaystackProvider.verifyWebhookSignature.mockReturnValue(false);

      await expect(
        controller.handlePaystackWebhook(
          buildReq(validBody),
          'forged_signature',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(mockSubscriptionsService.upgradePlan).not.toHaveBeenCalled();
    });

    it('should reject a request with no rawBody rather than re-serialising the body', async () => {
      await expect(
        controller.handlePaystackWebhook(
          { body: validBody } as any,
          'valid_signature',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(mockSubscriptionsService.upgradePlan).not.toHaveBeenCalled();
    });

    it('should not activate a plan when the amount paid is below its price', async () => {
      mockPaystackProvider.handleWebhookEvent.mockResolvedValue({
        success: true,
        userId: 'usr_test_123',
        planKey: PlanTier.PRO_LITE,
        reference: REFERENCE,
        amountKobo: 100, // ₦1 against a ₦1,000 plan
      });

      const response = await controller.handlePaystackWebhook(
        buildReq(validBody),
        'valid_signature',
      );

      expect(response).toEqual({
        status: 'rejected',
        message: 'Amount does not cover plan price',
      });
      expect(mockSubscriptionsService.upgradePlan).not.toHaveBeenCalled();
    });

    it('should skip duplicate processed payment', async () => {
      // The unique index on gatewayRef rejects the second delivery.
      mockDb.$transaction.mockRejectedValue({
        code: 'P2002',
        meta: { target: ['gatewayRef'] },
      });

      const response = await controller.handlePaystackWebhook(
        buildReq(validBody),
        'valid_signature',
      );

      expect(response).toEqual({ status: 'already_processed' });
      expect(mockNotifications.dispatch).not.toHaveBeenCalled();
    });

    it('should surface a unique violation on another column as an error', async () => {
      mockDb.$transaction.mockRejectedValue({
        code: 'P2002',
        meta: { target: ['userId'] },
        message: 'Unique constraint failed on userId',
      });

      const response = await controller.handlePaystackWebhook(
        buildReq(validBody),
        'valid_signature',
      );

      expect(response).toEqual({
        status: 'error',
        message: 'Unique constraint failed on userId',
      });
    });
  });

  describe('handlePaydestalWebhook', () => {
    it('should reject a webhook sent with no signature header', async () => {
      await expect(
        controller.handlePaydestalWebhook(
          buildReq(validBody),
          undefined as any,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(mockSubscriptionsService.upgradePlan).not.toHaveBeenCalled();
    });
  });

  describe('handleForwardedPaystackEvent (forwarded by wallet-nest)', () => {
    it('activates the subscription from the forwarded event and data', async () => {
      const response = await controller.handleForwardedPaystackEvent(
        validBody as any,
      );

      expect(mockPaystackProvider.handleWebhookEvent).toHaveBeenCalledWith(
        validBody,
      );
      expect(response).toEqual({
        status: 'success',
        userId: 'usr_test_123',
        planKey: PlanTier.PRO_LITE,
      });
      expect(mockTx.paymentRecord.create).toHaveBeenCalled();
    });

    it('does not re-check a Paystack signature (wallet-nest already did)', async () => {
      await controller.handleForwardedPaystackEvent(validBody as any);

      expect(
        mockPaystackProvider.verifyWebhookSignature,
      ).not.toHaveBeenCalled();
    });

    it('ignores events the provider does not act on, such as charge.failed', async () => {
      mockPaystackProvider.handleWebhookEvent.mockResolvedValue(null);

      await expect(
        controller.handleForwardedPaystackEvent({
          event: 'charge.failed',
          data: {},
        } as any),
      ).resolves.toEqual({ status: 'ignored' });
      expect(mockSubscriptionsService.upgradePlan).not.toHaveBeenCalled();
    });

    it('fails an underpaid charge so wallet-nest records it as FAILED', async () => {
      mockPaystackProvider.handleWebhookEvent.mockResolvedValue({
        success: true,
        userId: 'usr_test_123',
        planKey: PlanTier.PRO_LITE,
        reference: REFERENCE,
        amountKobo: 100,
      });

      await expect(
        controller.handleForwardedPaystackEvent(validBody as any),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(mockSubscriptionsService.upgradePlan).not.toHaveBeenCalled();
    });

    it('treats a repeat delivery as already processed, not an error', async () => {
      mockDb.$transaction.mockRejectedValue({
        code: 'P2002',
        meta: { target: ['gatewayRef'] },
      });

      await expect(
        controller.handleForwardedPaystackEvent(validBody as any),
      ).resolves.toEqual({ status: 'already_processed' });
    });
  });

  describe('prorated mid-cycle upgrades', () => {
    const UPGRADE_REF = 'SUB_PRO_PLUS_usr_test_123_1790000000';
    const periodEnd = new Date('2026-10-07T12:00:00Z');

    beforeEach(() => {
      mockPaystackProvider.handleWebhookEvent.mockResolvedValue({
        success: true,
        userId: 'usr_test_123',
        planKey: PlanTier.PRO_PLUS,
        reference: UPGRADE_REF,
        amountKobo: 25000,
        checkoutKind: 'prorated_upgrade',
        fromPlanKey: PlanTier.PRO_LITE,
        pricedPeriodEnd: periodEnd.toISOString(),
      });
      mockDb.plan.findUnique.mockResolvedValue({
        id: 'plan_pro_plus',
        key: PlanTier.PRO_PLUS,
        priceMonthly: 150000,
      });
      mockTx.$queryRaw = jest.fn().mockResolvedValue([]);
      mockTx.paymentRecord.findUnique = jest.fn().mockResolvedValue(null);
      mockTx.subscription = {
        findUnique: jest.fn().mockResolvedValue({
          userId: 'usr_test_123',
          status: 'ACTIVE',
          currentPeriodEnd: periodEnd,
          plan: { key: PlanTier.PRO_LITE, priceMonthly: 100000 },
        }),
      };
      mockSubscriptionsService.prorationQuote = jest.fn().mockReturnValue({
        amountKobo: 25000,
        fromPlanKey: PlanTier.PRO_LITE,
        periodEnd,
      });
    });

    it('applies a payment covering the difference, keeping the renewal date', async () => {
      await expect(
        controller.handleForwardedPaystackEvent(validBody as any),
      ).resolves.toEqual({
        status: 'success',
        userId: 'usr_test_123',
        planKey: PlanTier.PRO_PLUS,
      });

      // Locked before re-pricing, so two upgrades landing together serialise.
      expect(mockTx.$queryRaw).toHaveBeenCalled();
      expect(mockSubscriptionsService.upgradePlan).toHaveBeenCalledWith(
        'usr_test_123',
        PlanTier.PRO_PLUS,
        UPGRADE_REF,
        mockTx,
        { keepCurrentPeriod: true },
      );
      expect(mockTx.paymentRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: 25000,
          gatewayRef: UPGRADE_REF,
        }),
      });
    });

    it('is not refused for paying less than the full monthly price', async () => {
      // 25000 < 150000 would fail the full-price check; it must not apply here.
      await controller.handleForwardedPaystackEvent(validBody as any);
      expect(mockSubscriptionsService.upgradePlan).toHaveBeenCalled();
    });

    it('refuses, for a refund, when the subscription changed after pricing', async () => {
      // e.g. another upgrade already moved the user to Pro Plus.
      mockSubscriptionsService.prorationQuote.mockReturnValue(null);

      await expect(
        controller.handleForwardedPaystackEvent(validBody as any),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(mockSubscriptionsService.upgradePlan).not.toHaveBeenCalled();
      expect(mockTx.paymentRecord.create).not.toHaveBeenCalled();
    });

    it('refuses when priced from a different plan than the user now has', async () => {
      mockSubscriptionsService.prorationQuote.mockReturnValue({
        amountKobo: 25000,
        fromPlanKey: PlanTier.FREE,
        periodEnd,
      });

      await expect(
        controller.handleForwardedPaystackEvent(validBody as any),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(mockSubscriptionsService.upgradePlan).not.toHaveBeenCalled();
    });

    it('refuses, for a refund, when the renewal date moved after pricing', async () => {
      // An early renewal of Pro Lite in another tab: same plan, a month more
      // to credit, so the payment was priced for a period that is gone.
      mockSubscriptionsService.prorationQuote.mockReturnValue({
        amountKobo: 75000,
        fromPlanKey: PlanTier.PRO_LITE,
        periodEnd: new Date('2026-11-07T12:00:00Z'),
      });

      await expect(
        controller.handleForwardedPaystackEvent(validBody as any),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(mockSubscriptionsService.upgradePlan).not.toHaveBeenCalled();
    });

    it('refuses a prorated payment that carries no priced renewal date', async () => {
      mockPaystackProvider.handleWebhookEvent.mockResolvedValue({
        success: true,
        userId: 'usr_test_123',
        planKey: PlanTier.PRO_PLUS,
        reference: UPGRADE_REF,
        amountKobo: 25000,
        checkoutKind: 'prorated_upgrade',
        fromPlanKey: PlanTier.PRO_LITE,
      });

      await expect(
        controller.handleForwardedPaystackEvent(validBody as any),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(mockSubscriptionsService.upgradePlan).not.toHaveBeenCalled();
    });

    it('accepts a payment 1 kobo short of a re-price that rounded up', async () => {
      // Quoted 25000 at checkout; seconds later the separately rounded
      // prices give 25001 for less time (see the service spec).
      mockSubscriptionsService.prorationQuote.mockReturnValue({
        amountKobo: 25001,
        fromPlanKey: PlanTier.PRO_LITE,
        periodEnd,
      });

      await expect(
        controller.handleForwardedPaystackEvent(validBody as any),
      ).resolves.toMatchObject({ status: 'success' });
    });

    it('refuses a payment that no longer covers the difference due', async () => {
      mockSubscriptionsService.prorationQuote.mockReturnValue({
        amountKobo: 30000,
        fromPlanKey: PlanTier.PRO_LITE,
        periodEnd,
      });

      await expect(
        controller.handleForwardedPaystackEvent(validBody as any),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(mockSubscriptionsService.upgradePlan).not.toHaveBeenCalled();
    });

    it('treats a redelivery of an applied upgrade as already processed', async () => {
      // By now the user is on Pro Plus, so re-pricing would wrongly refuse it.
      mockTx.paymentRecord.findUnique.mockResolvedValue({ id: 'pr_1' });
      mockSubscriptionsService.prorationQuote.mockReturnValue(null);

      await expect(
        controller.handleForwardedPaystackEvent(validBody as any),
      ).resolves.toEqual({ status: 'already_processed' });
      expect(mockSubscriptionsService.upgradePlan).not.toHaveBeenCalled();
    });
  });
});
