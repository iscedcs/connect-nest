-- Idempotent by design. The test database already carries part of this schema from
-- an earlier `prisma db push` off the sub branch (Plan/Subscription/PaymentRecord and
-- most enum values exist, but Plan.limits, Subscription.notifiedLaunch, CpPlan and
-- SystemConfig do not), while production is clean. Every statement below is written to
-- create only what is missing so the same migration applies correctly to both.

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "PlanTier" AS ENUM ('FREE', 'PRO_LITE', 'PRO_PLUS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterEnum
-- Safe inside the migration transaction on PostgreSQL 12+, and none of these values are
-- referenced later in this file (a value added here could not be used in the same
-- transaction).
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_TRIAL_EXPIRED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_ACTIVATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_CANCELLED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_PAST_DUE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_LAUNCH_ANNOUNCEMENT';

-- AlterTable
ALTER TABLE "CpSubscription" ADD COLUMN IF NOT EXISTS "targetPlan" "CpSubscriptionPlan",
ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "trialStartsAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "trialUsed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CpSubscription" ALTER COLUMN "status" SET DEFAULT 'TRIALING';

-- CreateTable
CREATE TABLE IF NOT EXISTS "Plan" (
    "id" TEXT NOT NULL,
    "key" "PlanTier" NOT NULL,
    "name" TEXT NOT NULL,
    "priceMonthly" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "limits" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "trialStartDate" TIMESTAMP(3),
    "trialEndDate" TIMESTAMP(3),
    "trialUsed" BOOLEAN NOT NULL DEFAULT false,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "gatewayCustomerId" TEXT,
    "gatewaySubId" TEXT,
    "notifiedLaunch" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PaymentRecord" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" TEXT NOT NULL,
    "gatewayRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CpPlan" (
    "id" TEXT NOT NULL,
    "key" "CpSubscriptionPlan" NOT NULL,
    "name" TEXT NOT NULL,
    "priceMonthly" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "limits" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CpPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SystemConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "personalSubscriptionsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "connectPlusSubscriptionsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "bypassMode" TEXT NOT NULL DEFAULT 'OPEN_ACCESS',
    "maintenanceReason" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- Columns absent from the older db-push state of the test database. These run after the
-- CREATE TABLE statements above so they apply whether the table was just created or
-- already existed. Plan.limits in particular must exist before the seed INSERT below.
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "limits" JSONB;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "notifiedLaunch" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Plan_key_key" ON "Plan"("key");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Subscription_trialEndDate_idx" ON "Subscription"("trialEndDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Subscription_currentPeriodEnd_idx" ON "Subscription"("currentPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentRecord_gatewayRef_key" ON "PaymentRecord"("gatewayRef");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentRecord_subscriptionId_idx" ON "PaymentRecord"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CpPlan_key_key" ON "CpPlan"("key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CpSubscription_status_idx" ON "CpSubscription"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CpSubscription_trialEndsAt_idx" ON "CpSubscription"("trialEndsAt");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Seed the plan catalogues.
-- `prisma migrate deploy` never runs prisma/seed.ts, and the Dockerfile CMD only runs
-- `migrate deploy`. Without rows here, upgradePlan() throws NotFoundException on every
-- payment. Kept in sync with prisma/seed.ts, which upserts the same catalogue by key.
INSERT INTO "Plan" ("id", "key", "name", "priceMonthly", "isActive", "limits", "updatedAt") VALUES
  ('ba1c5977-f7bc-4b91-9028-df6fb0a5ac61', 'FREE', 'Free', 0, true, '{"profiles":1,"tapsPerDay":-1,"socialLinks":3,"videos":0,"files":0,"storageBytes":0,"meetingLinks":-1,"customForms":0,"analyticsHistoryDays":7,"contactExport":false,"removeIsceBranding":false,"themeCustomization":"none","moduleReordering":false,"spotifyItems":0,"cryptoWallets":0,"serviceCategories":0,"artisanDirectoryEligible":false,"publiclySearchable":false,"verifiedBadge":false,"prioritySupport":false,"priorityRanking":false}'::jsonb, CURRENT_TIMESTAMP),
  ('55b587ae-6c87-497c-8ccf-57fc7745627c', 'PRO_LITE', 'Pro Lite', 100000, true, '{"profiles":2,"tapsPerDay":-1,"socialLinks":10,"videos":1,"files":3,"storageBytes":26214400,"meetingLinks":-1,"customForms":1,"analyticsHistoryDays":30,"contactExport":true,"removeIsceBranding":false,"themeCustomization":"basic","moduleReordering":true,"spotifyItems":1,"cryptoWallets":1,"serviceCategories":3,"artisanDirectoryEligible":true,"publiclySearchable":true,"verifiedBadge":false,"prioritySupport":false,"priorityRanking":false}'::jsonb, CURRENT_TIMESTAMP),
  ('27d0956f-5143-4f83-8949-061cbf69a279', 'PRO_PLUS', 'Pro Plus', 150000, true, '{"profiles":5,"tapsPerDay":-1,"socialLinks":-1,"videos":5,"files":10,"storageBytes":104857600,"meetingLinks":-1,"customForms":5,"analyticsHistoryDays":-1,"contactExport":true,"removeIsceBranding":true,"themeCustomization":"full","moduleReordering":true,"spotifyItems":-1,"cryptoWallets":-1,"serviceCategories":-1,"artisanDirectoryEligible":true,"publiclySearchable":true,"verifiedBadge":true,"prioritySupport":true,"priorityRanking":true}'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "CpPlan" ("id", "key", "name", "priceMonthly", "isActive", "limits", "updatedAt") VALUES
  ('a7508475-f6af-4e84-87db-c0957f77db65', 'FREE', 'Free', 0, true, '{"workspaces":1,"staffPerWorkspace":5,"clientsPerWorkspace":20}'::jsonb, CURRENT_TIMESTAMP),
  ('315bc423-7ddf-44e4-b803-d63eaba74215', 'STARTER', 'Starter', 500000, true, '{"workspaces":3,"staffPerWorkspace":15,"clientsPerWorkspace":100}'::jsonb, CURRENT_TIMESTAMP),
  ('920638f3-e21d-47a5-89a6-0c9a959dcfe3', 'GROWTH', 'Growth', 1500000, true, '{"workspaces":10,"staffPerWorkspace":50,"clientsPerWorkspace":-1}'::jsonb, CURRENT_TIMESTAMP),
  ('269bdc18-d7d1-492f-ae77-793d2c33f2fb', 'BUSINESS', 'Business', 3500000, true, '{"workspaces":-1,"staffPerWorkspace":-1,"clientsPerWorkspace":-1}'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- Every existing org keeps working: SystemConfig defaults to OPEN_ACCESS so the newly
-- enforced Connect Plus quotas do not retroactively block orgs already over the FREE tier.
INSERT INTO "SystemConfig" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
