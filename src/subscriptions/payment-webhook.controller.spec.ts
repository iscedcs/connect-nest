import { BadRequestException } from '@nestjs/common';
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
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'plan_pro_lite', key: PlanTier.PRO_LITE, priceMonthly: 100000 }),
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
        controller.handlePaystackWebhook(buildReq(validBody), 'forged_signature'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(mockSubscriptionsService.upgradePlan).not.toHaveBeenCalled();
    });

    it('should reject a request with no rawBody rather than re-serialising the body', async () => {
      await expect(
        controller.handlePaystackWebhook({ body: validBody } as any, 'valid_signature'),
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
        controller.handlePaydestalWebhook(buildReq(validBody), undefined as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(mockSubscriptionsService.upgradePlan).not.toHaveBeenCalled();
    });
  });
});
