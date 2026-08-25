import { PaystackGatewayProvider } from './paystack.provider';
import * as crypto from 'crypto';
import { PlanTier } from '../../generated/prisma/client';

describe('PaystackGatewayProvider', () => {
  let provider: PaystackGatewayProvider;
  const testSecret = 'sk_test_secret_key_12345';

  beforeEach(() => {
    process.env.PAYSTACK_SECRET_KEY = testSecret;
    provider = new PaystackGatewayProvider();
  });

  describe('verifyWebhookSignature', () => {
    it('should return true for valid SHA512 signature', () => {
      const payload = JSON.stringify({ event: 'charge.success', data: { id: 123 } });
      const expectedSignature = crypto
        .createHmac('sha512', testSecret)
        .update(payload)
        .digest('hex');

      const isValid = provider.verifyWebhookSignature(payload, expectedSignature);
      expect(isValid).toBe(true);
    });

    it('should return false for invalid signature', () => {
      const payload = JSON.stringify({ event: 'charge.success' });
      const isValid = provider.verifyWebhookSignature(payload, 'invalid_signature');
      expect(isValid).toBe(false);
    });
  });

  describe('handleWebhookEvent', () => {
    it('should correctly parse charge.success with metadata', async () => {
      const event = {
        event: 'charge.success',
        data: {
          reference: 'SUB_PRO_LITE_usr123_1720000000',
          amount: 100000,
          customer: { customer_code: 'CUST_123' },
          metadata: {
            userId: 'usr123',
            planKey: PlanTier.PRO_LITE,
          },
        },
      };

      const result = await provider.handleWebhookEvent(event);
      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.userId).toBe('usr123');
      expect(result?.planKey).toBe(PlanTier.PRO_LITE);
      expect(result?.amountKobo).toBe(100000);
      expect(result?.gatewayCustomerId).toBe('CUST_123');
    });

    it('should return null for non-charge.success events', async () => {
      const event = { event: 'subscription.disable', data: {} };
      const result = await provider.handleWebhookEvent(event);
      expect(result).toBeNull();
    });
  });

  describe('initiateCheckout', () => {
    it('should initialize transaction against Paystack and return authorization url', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: true,
          message: 'Authorization URL created',
          data: {
            authorization_url: 'https://checkout.paystack.com/auth_xyz',
            access_code: 'acc_123',
            reference: 'SUB_PRO_LITE_usr_123_1720000000',
          },
        }),
      } as any);

      const result = await provider.initiateCheckout({
        userId: 'usr_123',
        email: 'user@example.com',
        planKey: PlanTier.PRO_LITE,
        amountKobo: 100000,
        callbackUrl: 'https://example.com/callback',
      });

      expect(result.checkoutUrl).toBe('https://checkout.paystack.com/auth_xyz');
      expect(result.accessCode).toBe('acc_123');
      expect(result.reference).toBe('SUB_PRO_LITE_usr_123_1720000000');
    });
  });

  describe('chargeRecurring', () => {
    it('should charge authorization successfully', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: true,
          message: 'Charge successful',
          data: {
            status: 'success',
            reference: 'REC_1720000000',
            amount: 100000,
          },
        }),
      } as any);

      const result = await provider.chargeRecurring({
        email: 'user@example.com',
        amountKobo: 100000,
        authorizationCode: 'AUTH_code_123',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('success');
      expect(result.reference).toBe('REC_1720000000');
    });
  });
});
