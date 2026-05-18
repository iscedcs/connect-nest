import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionsService } from '../subscriptions.service';
import { PlanLimits } from '../plan-limits.config';
import { PlanLimitException } from '../exceptions/plan-limit.exception';
import { PLAN_FEATURE_KEY } from '../decorators/plan-feature.decorator';
import { PlanTier } from '../../generated/prisma/client';

@Injectable()
export class PlanLimitGuard implements CanActivate {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.get<keyof PlanLimits>(
      PLAN_FEATURE_KEY,
      context.getHandler(),
    );

    if (!feature) return true;

    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.isce_auth?.id;
    if (!userId) throw new UnauthorizedException();

    const limits = await this.subscriptionsService.getUserLimits(userId);
    const limit = limits[feature];

    // Gate boolean feature flags and zero-value numeric limits
    if (limit === false || limit === 0) {
      throw new PlanLimitException(String(feature), PlanTier.PRO_LITE);
    }

    return true;
  }
}
