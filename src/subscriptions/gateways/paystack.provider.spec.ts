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
      const payload = JSON.stringify({
        event: 'charge.success',
        data: { id: 123 },
      });
      const expectedSignature = crypto
        .createHmac('sha512', testSecret)
        .update(payload)
        .digest('hex');

      const isValid = provider.verifyWebhookSignature(
        payload,
        expectedSignature,
      );
      expect(isValid).toBe(true);
    });

    it('should return false for invalid signature', () => {
      const payload = JSON.stringify({ event: 'charge.success' });
      const isValid = provider.verifyWebhookSignature(
        payload,
        'invalid_signature',
      );
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
      // A checkout from before proration existed is a full-price one.
      expect(result?.checkoutKind).toBe('full');
    });

    it('reads what a prorated upgrade was priced against from its metadata', async () => {
      const result = await provider.handleWebhookEvent({
        event: 'charge.success',
        data: {
          reference: 'SUB_PRO_PLUS_usr123_1790000000',
          amount: 25000,
          metadata: {
            userId: 'usr123',
            planKey: PlanTier.PRO_PLUS,
            checkoutKind: 'prorated_upgrade',
            fromPlanKey: PlanTier.PRO_LITE,
            renewsAt: '2026-10-07T12:00:00.000Z',
          },
        },
      });

      expect(result).toMatchObject({
        checkoutKind: 'prorated_upgrade',
        fromPlanKey: PlanTier.PRO_LITE,
        pricedPeriodEnd: '2026-10-07T12:00:00.000Z',
      });
    });

    it('should return null for non-charge.success events', async () => {
      const event = { event: 'subscription.disable', data: {} };
      const result = await provider.handleWebhookEvent(event);
      expect(result).toBeNull();
    });
  });

  describe('initiateCheckout', () => {
    const params = {
      userId: 'usr_123',
      email: 'user@example.com',
      planKey: PlanTier.PRO_LITE,
      amountKobo: 100000,
      callbackUrl: 'https://example.com/callback',
    };

    beforeEach(() => {
      process.env.WALLET_API_URL = 'http://wallet-nest:3334/';
      process.env.INTERNAL_API_KEY = 'internal-test-key';
      delete process.env.PAYSTACK_SECRET_KEY;
      provider = new PaystackGatewayProvider();
    });

    it('asks wallet-nest for the checkout, tagged as a connect charge, with no Paystack key', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 201,
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

      const result = await provider.initiateCheckout(params);

      expect(result.checkoutUrl).toBe('https://checkout.paystack.com/auth_xyz');
      expect(result.accessCode).toBe('acc_123');
      expect(result.reference).toBe('SUB_PRO_LITE_usr_123_1720000000');

      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe(
        'http://wallet-nest:3334/api/internal/paystack/initialize',
      );
      expect(init.headers['X-Internal-Secret']).toBe('internal-test-key');
      const body = JSON.parse(init.body);
      expect(body).toMatchObject({
        service: 'connect',
        email: 'user@example.com',
        amountKobo: 100000,
        callbackUrl: 'https://example.com/callback',
        metadata: { userId: 'usr_123', planKey: PlanTier.PRO_LITE },
      });
      expect(body.reference).toMatch(/^SUB_PRO_LITE_usr_123_\d+$/);
    });

    it('reports a wallet-nest failure as 502 without leaking its body', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({
          message: 'Payment provider rejected wallet-nest credentials',
        }),
      } as any);

      await expect(provider.initiateCheckout(params)).rejects.toMatchObject({
        status: 502,
        message: 'Could not start the card payment',
      });
    });

    it('reports wallet-nest being unreachable as 502', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(provider.initiateCheckout(params)).rejects.toMatchObject({
        status: 502,
      });
    });

    it('refuses to start when wallet-nest is not configured', async () => {
      delete process.env.WALLET_API_URL;
      provider = new PaystackGatewayProvider();

      await expect(provider.initiateCheckout(params)).rejects.toMatchObject({
        status: 400,
      });
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
