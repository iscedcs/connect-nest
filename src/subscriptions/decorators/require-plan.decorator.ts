import { SetMetadata } from '@nestjs/common';
import { PlanTier } from '../../generated/prisma/client';

export const REQUIRE_PLAN_KEY = 'requiredPlans';
export const RequirePlan = (...plans: PlanTier[]) =>
  SetMetadata(REQUIRE_PLAN_KEY, plans);
