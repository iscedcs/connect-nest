/**
 * Seed script — Plan catalogues (Connect Personal & Connect Plus)
 *
 * Run with:  npx ts-node prisma/seed.ts
 *
 * Idempotent — safe to run multiple times. Uses upsert so existing plans
 * are updated (not duplicated) and existing subscriptions are untouched.
 */

import 'dotenv/config';
import {
  PrismaClient,
  PlanTier,
  CpSubscriptionPlan,
} from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const PERSONAL_PLANS: Array<{
  key: PlanTier;
  name: string;
  priceMonthly: number; // kobo; 0 for FREE
  isActive: boolean;
  limits: Record<string, any>;
}> = [
  {
    key: PlanTier.FREE,
    name: 'Free',
    priceMonthly: 0,
    isActive: true,
    limits: {
      profiles: 1,
      tapsPerDay: -1,
      socialLinks: 3,
      videos: 0,
      files: 0,
      storageBytes: 0,
      meetingLinks: -1,
      customForms: 0,
      analyticsHistoryDays: 7,
      contactExport: false,
      removeIsceBranding: false,
      themeCustomization: 'none',
      moduleReordering: false,
      spotifyItems: 0,
      cryptoWallets: 0,
      serviceCategories: 0,
      artisanDirectoryEligible: false,
      publiclySearchable: false,
      verifiedBadge: false,
      prioritySupport: false,
      priorityRanking: false,
    },
  },
  {
    key: PlanTier.PRO_LITE,
    name: 'Pro Lite',
    priceMonthly: 100_000, // ₦1,000/month in kobo
    isActive: true,
    limits: {
      profiles: 2,
      tapsPerDay: -1,
      socialLinks: 10,
      videos: 1,
      files: 3,
      storageBytes: 26214400, // 25MB
      meetingLinks: -1,
      customForms: 1,
      analyticsHistoryDays: 30,
      contactExport: true,
      removeIsceBranding: false,
      themeCustomization: 'basic',
      moduleReordering: true,
      spotifyItems: 1,
      cryptoWallets: 1,
      serviceCategories: 3,
      artisanDirectoryEligible: true,
      publiclySearchable: true,
      verifiedBadge: false,
      prioritySupport: false,
      priorityRanking: false,
    },
  },
  {
    key: PlanTier.PRO_PLUS,
    name: 'Pro Plus',
    priceMonthly: 150_000, // ₦1,500/month in kobo
    isActive: true,
    limits: {
      profiles: 5,
      tapsPerDay: -1,
      socialLinks: -1,
      videos: 5,
      files: 10,
      storageBytes: 104857600, // 100MB
      meetingLinks: -1,
      customForms: 5,
      analyticsHistoryDays: -1,
      contactExport: true,
      removeIsceBranding: true,
      themeCustomization: 'full',
      moduleReordering: true,
      spotifyItems: -1,
      cryptoWallets: -1,
      serviceCategories: -1,
      artisanDirectoryEligible: true,
      publiclySearchable: true,
      verifiedBadge: true,
      prioritySupport: true,
      priorityRanking: true,
    },
  },
];

const CONNECT_PLUS_PLANS: Array<{
  key: CpSubscriptionPlan;
  name: string;
  priceMonthly: number; // kobo; 0 for FREE
  isActive: boolean;
  limits: {
    workspaces: number;
    staffPerWorkspace: number;
    clientsPerWorkspace: number;
  };
}> = [
  {
    key: CpSubscriptionPlan.FREE,
    name: 'Free',
    priceMonthly: 0,
    isActive: true,
    limits: {
      workspaces: 1,
      staffPerWorkspace: 5,
      clientsPerWorkspace: 20,
    },
  },
  {
    key: CpSubscriptionPlan.STARTER,
    name: 'Starter',
    priceMonthly: 500_000, // ₦5,000/month in kobo
    isActive: true,
    limits: {
      workspaces: 3,
      staffPerWorkspace: 15,
      clientsPerWorkspace: 100,
    },
  },
  {
    key: CpSubscriptionPlan.GROWTH,
    name: 'Growth',
    priceMonthly: 1_500_000, // ₦15,000/month in kobo
    isActive: true,
    limits: {
      workspaces: 10,
      staffPerWorkspace: 50,
      clientsPerWorkspace: -1,
    },
  },
  {
    key: CpSubscriptionPlan.BUSINESS,
    name: 'Business',
    priceMonthly: 3_500_000, // ₦35,000/month in kobo
    isActive: true,
    limits: {
      workspaces: -1,
      staffPerWorkspace: -1,
      clientsPerWorkspace: -1,
    },
  },
];

async function main() {
  console.log('Seeding Connect Personal Plan catalogue…');
  for (const plan of PERSONAL_PLANS) {
    const result = await prisma.plan.upsert({
      where: { key: plan.key },
      update: {
        name: plan.name,
        isActive: plan.isActive,
      },
      create: {
        key: plan.key,
        name: plan.name,
        priceMonthly: plan.priceMonthly,
        isActive: plan.isActive,
        limits: plan.limits,
      },
    });
    console.log(
      `  [Personal] ${result.key}: ₦${(result.priceMonthly / 100).toFixed(2)}/month (id: ${result.id})`,
    );
  }

  console.log('Seeding Connect Plus Plan catalogue…');
  for (const cpPlan of CONNECT_PLUS_PLANS) {
    const result = await prisma.cpPlan.upsert({
      where: { key: cpPlan.key },
      update: {
        name: cpPlan.name,
        isActive: cpPlan.isActive,
      },
      create: {
        key: cpPlan.key,
        name: cpPlan.name,
        priceMonthly: cpPlan.priceMonthly,
        isActive: cpPlan.isActive,
        limits: cpPlan.limits,
      },
    });
    console.log(
      `  [Connect Plus] ${result.key}: ₦${(result.priceMonthly / 100).toFixed(2)}/month (id: ${result.id})`,
    );
  }

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
