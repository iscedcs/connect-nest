import { PaymentWebhookController } from './payment-webhook.controller';
import { PlanTier } from '../generated/prisma/client';

describe('PaymentWebhookController', () => {
  let controller: PaymentWebhookController;
  let mockGatewayFactory: any;
  let mockSubscriptionsService: any;
  let mockDb: any;
  let mockNotifications: any;
  let mockPaystackProvider: any;

  beforeEach(() => {
    mockPaystackProvider = {
      verifyWebhookSignature: jest.fn().mockReturnValue(true),
      handleWebhookEvent: jest.fn().mockResolvedValue({
        success: true,
        userId: 'usr_test_123',
        planKey: PlanTier.PRO_LITE,
        reference: 'SUB_PRO_LITE_usr_test_123_1720000000',
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

    mockDb = {
      paymentRecord: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'pr_123' }),
      },
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
      const req = {
        body: {
          event: 'charge.success',
          data: {
            reference: 'SUB_PRO_LITE_usr_test_123_1720000000',
            amount: 100000,
            metadata: { userId: 'usr_test_123', planKey: PlanTier.PRO_LITE },
          },
        },
      } as any;

      const response = await controller.handlePaystackWebhook(
        req,
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
        'SUB_PRO_LITE_usr_test_123_1720000000',
      );
      expect(mockDb.paymentRecord.create).toHaveBeenCalled();
      expect(mockNotifications.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'usr_test_123',
          type: 'SUBSCRIPTION_ACTIVATED',
        }),
      );
    });

    it('should skip duplicate processed payment', async () => {
      mockDb.paymentRecord.findFirst.mockResolvedValue({
        id: 'pr_existing',
        status: 'success',
      });

      const req = {
        body: {
          event: 'charge.success',
          data: { reference: 'SUB_PRO_LITE_usr_test_123_1720000000' },
        },
      } as any;

      const response = await controller.handlePaystackWebhook(
        req,
        'valid_signature',
      );

      expect(response).toEqual({ status: 'already_processed' });
      expect(mockSubscriptionsService.upgradePlan).not.toHaveBeenCalled();
    });
  });
});
