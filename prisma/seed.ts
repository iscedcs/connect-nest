/**
 * Seed script — Plan catalogue (Connect Personal)
 *
 * Run with:  npx ts-node prisma/seed.ts
 * Or add to package.json:  "seed": "ts-node prisma/seed.ts"
 *
 * Idempotent — safe to run multiple times. Uses upsert so existing plans
 * are updated (not duplicated) and existing subscriptions are untouched.
 */

import { PrismaClient, PlanTier } from '../src/generated/prisma';

const prisma = new PrismaClient();

const PLANS: Array<{
  key: PlanTier;
  name: string;
  priceMonthly: number; // kobo; 0 for FREE
  isActive: boolean;
}> = [
  {
    key: PlanTier.FREE,
    name: 'Free',
    priceMonthly: 0,
    isActive: true,
  },
  {
    key: PlanTier.PRO_LITE,
    name: 'Pro Lite',
    priceMonthly: 100_000, // ₦1,000/month in kobo
    isActive: true,
  },
  {
    key: PlanTier.PRO_PLUS,
    name: 'Pro Plus',
    priceMonthly: 150_000, // ₦1,500/month in kobo
    isActive: true,
  },
];

async function main() {
  console.log('Seeding Plan catalogue…');

  for (const plan of PLANS) {
    const result = await prisma.plan.upsert({
      where: { key: plan.key },
      update: {
        name: plan.name,
        isActive: plan.isActive,
        // Do NOT overwrite priceMonthly on update — respect admin-adjusted prices
      },
      create: {
        key: plan.key,
        name: plan.name,
        priceMonthly: plan.priceMonthly,
        isActive: plan.isActive,
      },
    });
    console.log(
      `  ${result.key}: ₦${(result.priceMonthly / 100).toFixed(2)}/month (id: ${result.id})`,
    );
  }

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
