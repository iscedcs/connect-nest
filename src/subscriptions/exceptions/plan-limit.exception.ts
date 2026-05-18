import { ForbiddenException } from '@nestjs/common';
import { PlanTier } from '../../generated/prisma/client';

export class PlanLimitException extends ForbiddenException {
  constructor(feature: string, upgradeRequired: PlanTier) {
    super({
      statusCode: 403,
      error: 'PLAN_LIMIT_EXCEEDED',
      message: `Your plan does not support this action: ${feature}`,
      upgradeRequired,
    });
  }
}
