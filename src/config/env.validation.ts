/**
 * Fail-fast environment validation schema.
 * The server will refuse to boot if any required variable is missing or invalid.
 * Import this via ConfigModule.forRoot({ validate }) in app.module.ts.
 */

import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Database
  DATABASE_URL: Joi.string().uri().required(),

  // JWT
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // Service-to-service
  INTERNAL_API_KEY: Joi.string().min(16).required(),

  // Connect Plus webhooks
  AUTH_INVITE_WEBHOOK_SECRET: Joi.string().min(16).required(),

  // Paystack
  PAYSTACK_SECRET_KEY: Joi.string().required(),

  // DigitalOcean Spaces (optional until Track 4 is implemented)
  DO_SPACES_KEY: Joi.string().optional(),
  DO_SPACES_SECRET: Joi.string().optional(),
  DO_SPACES_BUCKET: Joi.string().optional(),
  DO_SPACES_ENDPOINT: Joi.string().uri().optional(),
  DO_SPACES_REGION: Joi.string().optional(),

  // App
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
}).options({ allowUnknown: true }); // allow other vars (Sentry DSN, etc.)
