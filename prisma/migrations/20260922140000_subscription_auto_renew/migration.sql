-- Automatic renewal (saved card or wallet mandate) and trials that start with
-- a card check. Idempotent, like 20260819101500: the test database was built
-- partly with `prisma db push`, production is clean.

-- AlterEnum
-- Safe inside the migration transaction on PostgreSQL 12+: neither value is
-- used later in this file.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_RENEWAL_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_RENEWAL_FAILED';

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "autoRenew" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "savedCardId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "savedCardLabel" TEXT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "walletMandateId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "renewalAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "lastRenewalAttemptAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "renewalReminderFor" TIMESTAMP(3);
