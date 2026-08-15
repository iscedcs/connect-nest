import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { NotificationDispatcher } from '../notification/notification-dispatcher.service';
import {
  PLAN_LIMITS,
  PlanKey,
  PlanLimits,
  UNLIMITED_PLAN_LIMITS,
} from './plan-limits.config';
import {
  PlanTier,
  SubscriptionStatus,
  Subscription,
  Plan,
} from '../generated/prisma/client';
import { SystemConfigService } from '../system-config/system-config.service';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationDispatcher,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  // ─── Core Methods ──────────────────────────────────────────────────────────

  /**
   * Create a subscription for a user.
   * - FREE plan → status ACTIVE, no trial
   * - PRO_LITE / PRO_PLUS → status TRIALING, 6-month trial, trialUsed = true
   *
   * @param skipConflictCheck Set to true when auto-creating from ProfileService
   *   to silently skip if a subscription already exists.
   */
  async createSubscription(
    userId: string,
    planKey: PlanTier,
    skipConflictCheck = false,
  ): Promise<Subscription> {
    const existing = await this.db.subscription.findUnique({
      where: { userId },
    });

    if (existing) {
      if (skipConflictCheck) return existing;
      throw new ConflictException('User already has an active subscription');
    }

    const plan = await this.db.plan.findUnique({ where: { key: planKey } });
    if (!plan) {
      throw new NotFoundException(`Plan not found: ${planKey}`);
    }

    const now = new Date();
    const isFree = planKey === PlanTier.FREE;

    return this.db.subscription.create({
      data: {
        userId,
        planId: plan.id,
        status: isFree ? SubscriptionStatus.ACTIVE : SubscriptionStatus.TRIALING,
        trialStartDate: isFree ? null : now,
        trialEndDate: isFree ? null : this.addMonths(now, 6),
        trialUsed: !isFree,
      },
    });
  }

  async getActiveSubscription(
    userId: string,
  ): Promise<Subscription & { plan: Plan }> {
    let sub = await this.db.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!sub) {
      // Auto-bootstrap a FREE subscription for existing legacy users
      await this.createSubscription(userId, PlanTier.FREE, true);
      sub = await this.db.subscription.findUnique({
        where: { userId },
        include: { plan: true },
      });
    }

    if (!sub) throw new NotFoundException('No subscription found for user');
    return sub;
  }

  private readonly planLimitsCache = new Map<PlanTier, PlanLimits>();

  /**
   * Parse and resolve dynamic plan limits from a Plan database entity,
   * merging with code defaults and translating -1 to Infinity.
   */
  resolvePlanLimits(plan: Plan): PlanLimits {
    const planKey = plan.key as PlanKey;
    const defaults = PLAN_LIMITS[planKey] || PLAN_LIMITS.FREE;

    if (!plan.limits || typeof plan.limits !== 'object') {
      return defaults;
    }

    const rawLimits = plan.limits as Record<string, any>;
    const merged: any = { ...defaults };

    for (const key of Object.keys(defaults)) {
      if (rawLimits[key] !== undefined && rawLimits[key] !== null) {
        // Convert -1 or "unlimited" to Infinity for numeric fields
        if (rawLimits[key] === -1 || rawLimits[key] === 'unlimited') {
          merged[key] = Infinity;
        } else {
          merged[key] = rawLimits[key];
        }
      }
    }

    return merged as PlanLimits;
  }

  /**
   * Resolve the effective plan limits for a user.
   * TRIALING and ACTIVE → full limits for their plan.
   * Everything else (EXPIRED, CANCELLED, PAST_DUE) → FREE limits.
   * Falls back to FREE if the user has no subscription at all.
   */
  async getUserLimits(userId: string): Promise<PlanLimits> {
    if (await this.systemConfigService.isPersonalBypassed()) {
      return UNLIMITED_PLAN_LIMITS;
    }

    const sub = await this.db.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!sub) {
      const freePlan = await this.db.plan.findUnique({
        where: { key: PlanTier.FREE },
      });
      return freePlan ? this.resolvePlanLimits(freePlan) : PLAN_LIMITS.FREE;
    }

    if (
      sub.status === SubscriptionStatus.TRIALING ||
      sub.status === SubscriptionStatus.ACTIVE
    ) {
      return this.resolvePlanLimits(sub.plan);
    }

    const freePlan = await this.db.plan.findUnique({
      where: { key: PlanTier.FREE },
    });
    return freePlan ? this.resolvePlanLimits(freePlan) : PLAN_LIMITS.FREE;
  }

  /**
   * Check whether a user is within the numeric limit for a feature.
   * Returns true if within limit (Infinity always passes).
   */
  async checkLimit(
    userId: string,
    feature: keyof PlanLimits,
    currentCount: number,
  ): Promise<boolean> {
    const limits = await this.getUserLimits(userId);
    const limit = limits[feature];
    if (typeof limit !== 'number') return true; // boolean feature — not a count
    return currentCount < limit;
  }

  async upgradePlan(
    userId: string,
    newPlanKey: PlanTier,
    gatewaySubId: string,
  ): Promise<Subscription> {
    let sub = await this.db.subscription.findUnique({ where: { userId } });
    if (!sub) {
      sub = await this.createSubscription(userId, PlanTier.FREE, true);
    }

    const plan = await this.db.plan.findUnique({ where: { key: newPlanKey } });
    if (!plan) throw new NotFoundException(`Plan not found: ${newPlanKey}`);

    const now = new Date();

    return this.db.subscription.update({
      where: { userId },
      data: {
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        gatewaySubId,
        currentPeriodStart: now,
        currentPeriodEnd: this.addMonths(now, 1),
      },
    });
  }

  async cancelSubscription(userId: string): Promise<Subscription> {
    const sub = await this.db.subscription.findUnique({ where: { userId } });
    if (!sub) throw new NotFoundException('No subscription found for user');

    return this.db.subscription.update({
      where: { userId },
      data: {
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });
  }

  // ─── Trial & Expiry Logic ─────────────────────────────────────────────────

  async handleTrialExpiry(subscriptionId: string): Promise<void> {
    const sub = await this.db.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    });
    if (!sub) return;

    if (sub.gatewayCustomerId) {
      // Attempt to charge via Paydestal — placeholder for gateway integration
      // Payment initiation is handled in payment-webhook.handler.ts
      // If charge succeeds the webhook will call upgradePlan().
      // For now log and fall through to downgrade.
      this.logger.log(
        `Trial expired for user ${sub.userId} — gateway charge pending (gatewayCustomerId: ${sub.gatewayCustomerId})`,
      );
      return;
    }

    await this.downgradeToFree(subscriptionId);
  }

  async downgradeToFree(subscriptionId: string): Promise<void> {
    const sub = await this.db.subscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!sub) return;

    const freePlan = await this.db.plan.findUnique({
      where: { key: PlanTier.FREE },
    });
    if (!freePlan) {
      this.logger.error('FREE plan not found in DB — cannot downgrade');
      return;
    }

    await this.db.subscription.update({
      where: { id: subscriptionId },
      data: {
        planId: freePlan.id,
        status: SubscriptionStatus.EXPIRED,
      },
    });

    await this.notifications.dispatch({
      userId: sub.userId,
      type: 'SUBSCRIPTION_TRIAL_EXPIRED',
      title: 'Your trial has ended',
      message:
        'Your free trial has expired. You have been moved to the Free plan. Upgrade anytime to restore full access.',
      skipPush: false,
    });
  }

  // ─── Cron Jobs ────────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processTrialExpiries(): Promise<void> {
    const isEnabled = await this.systemConfigService.isPersonalSubscriptionEnabled();
    if (!isEnabled) {
      this.logger.log('Subscriptions are globally disabled — skipping trial expiry checks');
      return;
    }

    const expired = await this.db.subscription.findMany({
      where: {
        status: SubscriptionStatus.TRIALING,
        trialEndDate: { lte: new Date() },
      },
    });

    this.logger.log(`Processing ${expired.length} expired trial(s)`);
    for (const sub of expired) {
      await this.handleTrialExpiry(sub.id);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processPaidExpiries(): Promise<void> {
    const isEnabled = await this.systemConfigService.isPersonalSubscriptionEnabled();
    if (!isEnabled) {
      this.logger.log('Subscriptions are globally disabled — skipping paid expiry checks');
      return;
    }

    const expired = await this.db.subscription.findMany({
      where: {
        status: { in: [SubscriptionStatus.CANCELLED, SubscriptionStatus.PAST_DUE] },
        currentPeriodEnd: { lte: new Date() },
      },
    });

    this.logger.log(`Processing ${expired.length} expired paid subscription(s)`);
    for (const sub of expired) {
      await this.downgradeToFree(sub.id);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /**
   * System Admin: dynamically update a plan's price, active state, name, and feature limits.
   * Used by PATCH /subscriptions/admin/plans/:planKey
   */
  async updatePlanDetails(
    planKey: PlanTier,
    dto: {
      priceMonthly?: number;
      name?: string;
      isActive?: boolean;
      limits?: Record<string, any>;
    },
  ): Promise<Plan & { resolvedLimits: PlanLimits }> {
    const existing = await this.db.plan.findUnique({ where: { key: planKey } });
    if (!existing) throw new NotFoundException(`Plan not found: ${planKey}`);

    let updatedLimits = existing.limits as Record<string, any> || {};
    if (dto.limits) {
      updatedLimits = {
        ...updatedLimits,
        ...dto.limits,
      };
    }

    const updated = await this.db.plan.update({
      where: { key: planKey },
      data: {
        ...(dto.priceMonthly !== undefined && { priceMonthly: dto.priceMonthly }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.limits !== undefined && { limits: updatedLimits }),
      },
    });

    this.planLimitsCache.delete(planKey);
    const resolvedLimits = this.resolvePlanLimits(updated);

    return {
      ...updated,
      resolvedLimits,
    };
  }

  /**
   * Legacy alias for backward compatibility.
   */
  async updatePlanPrice(
    planKey: PlanTier,
    dto: { priceMonthly?: number; name?: string; isActive?: boolean; limits?: Record<string, any> },
  ): Promise<Plan> {
    const result = await this.updatePlanDetails(planKey, dto);
    return result;
  }

  async getPlanByKey(planKey: PlanTier): Promise<Plan | null> {
    return this.db.plan.findUnique({ where: { key: planKey } });
  }

  async getActivePlans(): Promise<Array<Plan & { resolvedLimits: PlanLimits }>> {
    const plans = await this.db.plan.findMany({
      where: { isActive: true },
      orderBy: { priceMonthly: 'asc' },
    });

    return plans.map((p) => ({
      ...p,
      resolvedLimits: this.resolvePlanLimits(p),
    }));
  }

  async getAllPlansAdmin(): Promise<Array<Plan & { resolvedLimits: PlanLimits }>> {
    const plans = await this.db.plan.findMany({
      orderBy: { priceMonthly: 'asc' },
    });

    return plans.map((p) => ({
      ...p,
      resolvedLimits: this.resolvePlanLimits(p),
    }));
  }

  /** Build the response shape for GET /subscriptions/me */
  buildSubscriptionResponse(sub: Subscription & { plan: Plan }) {
    const now = new Date();
    const isInTrial = sub.status === SubscriptionStatus.TRIALING;
    const daysRemaining =
      isInTrial && sub.trialEndDate
        ? Math.max(
            0,
            Math.ceil(
              (sub.trialEndDate.getTime() - now.getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          )
        : null;

    return {
      plan: {
        key: sub.plan.key,
        name: sub.plan.name,
        priceMonthly: sub.plan.priceMonthly,
      },
      status: sub.status,
      isInTrial,
      trialEndDate: sub.trialEndDate ?? null,
      daysRemaining,
      currentPeriodEnd: sub.currentPeriodEnd ?? null,
    };
  }

  private addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }
}
