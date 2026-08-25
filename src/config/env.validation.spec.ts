import 'reflect-metadata';
import { validate, Environment } from './env.validation';

describe('Environment Validation', () => {
  const validDevConfig = {
    NODE_ENV: Environment.Development,
    DATABASE_URL: 'postgresql://localhost:5432/connect_test',
    PORT: 4990,
  };

  const validProdConfig = {
    NODE_ENV: Environment.Production,
    DATABASE_URL: 'postgresql://prod-db:5432/connect_prod',
    JWT_ACCESS_SECRET: 'super-secret-jwt-key-12345',
    INTERNAL_API_KEY: 'super-secret-internal-key-67890',
    PAYSTACK_SECRET_KEY: 'sk_live_paystack_secret_123',
    AUTH_INVITE_WEBHOOK_SECRET: 'whsec_auth_invite_secret_456',
    DO_SPACES_KEY: 'DO00EXAMPLEKEY',
    DO_SPACES_SECRET: 'DO_SECRET_KEY_EXAMPLE_ABCDEF',
    PORT: 4990,
  };

  it('should pass with minimal valid development config', () => {
    expect(() => validate(validDevConfig)).not.toThrow();
  });

  it('should pass with complete valid production config', () => {
    const validated = validate(validProdConfig);
    expect(validated.NODE_ENV).toBe(Environment.Production);
    expect(validated.DATABASE_URL).toBe(validProdConfig.DATABASE_URL);
  });

  it('should fail when DATABASE_URL is missing', () => {
    const config = { ...validDevConfig };
    delete (config as any).DATABASE_URL;

    expect(() => validate(config)).toThrow(/DATABASE_URL is required/);
  });

  describe('Production mode strict validation', () => {
    it('should fail when JWT_ACCESS_SECRET is missing in production', () => {
      const config = { ...validProdConfig };
      delete (config as any).JWT_ACCESS_SECRET;

      expect(() => validate(config)).toThrow(/JWT_ACCESS_SECRET is required in production/);
    });

    it('should fail when INTERNAL_API_KEY is missing in production', () => {
      const config = { ...validProdConfig };
      delete (config as any).INTERNAL_API_KEY;

      expect(() => validate(config)).toThrow(/INTERNAL_API_KEY is required in production/);
    });

    it('should fail when PAYSTACK_SECRET_KEY is missing in production', () => {
      const config = { ...validProdConfig };
      delete (config as any).PAYSTACK_SECRET_KEY;

      expect(() => validate(config)).toThrow(/PAYSTACK_SECRET_KEY is required in production/);
    });

    it('should fail when AUTH_INVITE_WEBHOOK_SECRET is missing in production', () => {
      const config = { ...validProdConfig };
      delete (config as any).AUTH_INVITE_WEBHOOK_SECRET;

      expect(() => validate(config)).toThrow(/AUTH_INVITE_WEBHOOK_SECRET is required in production/);
    });

    it('should fail when DO_SPACES_KEY and AWS_ACCESS_KEY_ID are missing in production', () => {
      const config = { ...validProdConfig };
      delete (config as any).DO_SPACES_KEY;

      expect(() => validate(config)).toThrow(/DO_SPACES_KEY \(or AWS_ACCESS_KEY_ID\) is required in production/);
    });

    it('should pass in production when AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are provided instead of DO_SPACES', () => {
      const config = { ...validProdConfig };
      delete (config as any).DO_SPACES_KEY;
      delete (config as any).DO_SPACES_SECRET;
      (config as any).AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
      (config as any).AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';

      expect(() => validate(config)).not.toThrow();
    });
  });
});
