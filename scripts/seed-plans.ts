import 'dotenv/config';
import { PrismaClient, PlanTier } from 'src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PLAN_LIMITS } from 'src/subscriptions/plan-limits.config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function seedPlans() {
  const plans: { key: PlanTier; name: string; priceMonthly: number }[] = [
    { key: PlanTier.FREE, name: PLAN_LIMITS.FREE.name, priceMonthly: 0 },
    {
      key: PlanTier.PRO_LITE,
      name: PLAN_LIMITS.PRO_LITE.name,
      priceMonthly: 100000, // ₦1,000 in kobo
    },
    {
      key: PlanTier.PRO_PLUS,
      name: PLAN_LIMITS.PRO_PLUS.name,
      priceMonthly: 150000, // ₦1,500 in kobo
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { key: plan.key },
      update: { name: plan.name, priceMonthly: plan.priceMonthly },
      create: plan,
    });
    console.log(`✔ Upserted plan: ${plan.name}`);
  }

  console.log('Plans seeded successfully.');
}

seedPlans()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
