import { SetMetadata } from '@nestjs/common';
import { PlanLimits } from '../plan-limits.config';

export const PLAN_FEATURE_KEY = 'planFeature';
export const PlanFeature = (feature: keyof PlanLimits) =>
  SetMetadata(PLAN_FEATURE_KEY, feature);
