import {
  Injectable,
  BadRequestException,
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

/** Days a paid plan keeps working after its period ends unpaid, before it drops to Free. */
export const PAST_DUE_GRACE_DAYS = 3;

/** How close to the end of a paid period the same plan can be paid for again. */
export const RENEWAL_WINDOW_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

type LifecycleFields = Pick<
  Subscription,
  'status' | 'currentPeriodEnd' | 'trialEndDate'
>;

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
        status: isFree
          ? SubscriptionStatus.ACTIVE
          : SubscriptionStatus.TRIALING,
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
   * When the plan's features stop working, or null if nothing is scheduled
   * to end them.
   * - ACTIVE: the end of the paid period (the midnight job then marks it PAST_DUE).
   * - TRIALING: the end of the trial.
   * - CANCELLED: the end of what was paid for, or of the trial if never paid.
   *   Cancelling promises access until then, so it must not cut access early.
   * - PAST_DUE: the end of the grace days after the unpaid period ended.
   * - EXPIRED: already ended.
   */
  accessEndsAt(sub: LifecycleFields): Date | null {
    switch (sub.status) {
      case SubscriptionStatus.ACTIVE:
        return sub.currentPeriodEnd ?? null;
      case SubscriptionStatus.TRIALING:
        return sub.trialEndDate ?? null;
      case SubscriptionStatus.CANCELLED:
        return sub.currentPeriodEnd ?? sub.trialEndDate ?? null;
      case SubscriptionStatus.PAST_DUE:
        return sub.currentPeriodEnd
          ? new Date(
              sub.currentPeriodEnd.getTime() + PAST_DUE_GRACE_DAYS * DAY_MS,
            )
          : null;
      default:
        return null;
    }
  }

  /**
   * Whether the subscription still unlocks its plan's features at `now`.
   * ACTIVE and TRIALING always do: the midnight jobs move them on once their
   * dates pass. CANCELLED and PAST_DUE do until `accessEndsAt`.
   */
  isEntitled(sub: LifecycleFields, now = new Date()): boolean {
    if (
      sub.status === SubscriptionStatus.ACTIVE ||
      sub.status === SubscriptionStatus.TRIALING
    ) {
      return true;
    }
    if (
      sub.status === SubscriptionStatus.CANCELLED ||
      sub.status === SubscriptionStatus.PAST_DUE
    ) {
      const end = this.accessEndsAt(sub);
      return end !== null && end > now;
    }
    return false;
  }

  /**
   * Why a checkout for `planKey` must not start, or null if it may.
   * Paying for the plan you already have is only allowed in the last
   * RENEWAL_WINDOW_DAYS of the paid period: earlier, it is almost always a
   * double payment (a second click, or a page that hasn't caught up yet).
   */
  checkoutBlockedReason(
    sub: LifecycleFields & { plan: Pick<Plan, 'key' | 'name'> },
    planKey: PlanTier,
    now = new Date(),
  ): string | null {
    if (
      sub.plan.key !== planKey ||
      sub.status !== SubscriptionStatus.ACTIVE ||
      !sub.currentPeriodEnd
    ) {
      return null;
    }
    const renewalOpensAt = new Date(
      sub.currentPeriodEnd.getTime() - RENEWAL_WINDOW_DAYS * DAY_MS,
    );
    if (now >= renewalOpensAt) return null;

    const day = (d: Date) => d.toISOString().slice(0, 10);
    return (
      `You're already on ${sub.plan.name} until ${day(sub.currentPeriodEnd)}. ` +
      `You can renew from ${day(renewalOpensAt)}.`
    );
  }

  /** Throws a 409 when a checkout for `planKey` must not start. */
  async assertCheckoutAllowed(
    userId: string,
    planKey: PlanTier,
  ): Promise<void> {
    const sub = await this.getActiveSubscription(userId);
    const reason = this.checkoutBlockedReason(sub, planKey);
    if (reason) throw new ConflictException(reason);
  }

  /**
   * Resolve the effective plan limits for a user: their plan's limits while
   * `isEntitled`, otherwise FREE limits. Falls back to FREE if the user has
   * no subscription at all.
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

    if (this.isEntitled(sub)) {
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

  /**
   * `tx` lets a caller run the upgrade inside its own transaction — the payment
   * webhook does this so that a duplicate gateway reference rolls the upgrade back
   * instead of extending the paid period a second time.
   */
  async upgradePlan(
    userId: string,
    newPlanKey: PlanTier,
    gatewaySubId: string,
    tx?: Pick<DatabaseService, 'subscription' | 'plan'>,
  ): Promise<Subscription> {
    const db = tx ?? this.db;

    let sub = await db.subscription.findUnique({ where: { userId } });
    if (!sub) {
      sub = await this.createSubscription(userId, PlanTier.FREE, true);
    }

    const plan = await db.plan.findUnique({ where: { key: newPlanKey } });
    if (!plan) throw new NotFoundException(`Plan not found: ${newPlanKey}`);

    const now = new Date();

    // Paying again for the same plan before its period ends (an early
    // renewal, or resubscribing after cancelling) adds a month to the end
    // already paid for, so no paid days are lost. A different plan, or a
    // lapsed one, starts a fresh month today.
    const extendsCurrentPeriod =
      sub.planId === plan.id &&
      sub.currentPeriodEnd !== null &&
      sub.currentPeriodEnd > now;
    const periodBase = extendsCurrentPeriod ? sub.currentPeriodEnd! : now;

    return db.subscription.update({
      where: { userId },
      data: {
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        gatewaySubId,
        cancelledAt: null,
        currentPeriodStart: extendsCurrentPeriod ? sub.currentPeriodStart : now,
        currentPeriodEnd: this.addMonths(periodBase, 1),
      },
    });
  }

  async cancelSubscription(userId: string): Promise<Subscription> {
    const sub = await this.db.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });
    if (!sub) throw new NotFoundException('No subscription found for user');

    if (sub.plan.key === PlanTier.FREE) {
      throw new BadRequestException('The Free plan has nothing to cancel');
    }
    // Idempotent: a second cancel must not move cancelledAt or revive an
    // expired plan's status.
    if (
      sub.status === SubscriptionStatus.CANCELLED ||
      sub.status === SubscriptionStatus.EXPIRED
    ) {
      return sub;
    }

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

  /**
   * Move a subscription to the Free plan. `reason` only picks the message:
   * the user must be told why they lost their features, and a paid plan
   * running out is not "your trial has ended".
   */
  async downgradeToFree(
    subscriptionId: string,
    reason: 'trial_ended' | 'cancelled_period_ended' | 'unpaid' = 'trial_ended',
  ): Promise<void> {
    const sub = await this.db.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
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

    const planName = sub.plan?.name ?? 'paid';
    const notices = {
      trial_ended: {
        type: 'SUBSCRIPTION_TRIAL_EXPIRED' as const,
        title: 'Your trial has ended',
        message:
          'Your free trial has expired. You have been moved to the Free plan. Upgrade anytime to restore full access.',
      },
      cancelled_period_ended: {
        type: 'SUBSCRIPTION_CANCELLED' as const,
        title: `Your ${planName} plan has ended`,
        message:
          'The period you paid for is over, so you are now on the Free plan. Subscribe again anytime to get your features back.',
      },
      unpaid: {
        type: 'SUBSCRIPTION_CANCELLED' as const,
        title: `Your ${planName} plan has ended`,
        message:
          'We did not receive a renewal payment, so you are now on the Free plan. Subscribe again anytime to get your features back.',
      },
    };

    await this.notifications.dispatch({
      userId: sub.userId,
      ...notices[reason],
      skipPush: false,
    });
  }

  // ─── Cron Jobs ────────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processTrialExpiries(): Promise<void> {
    const isEnabled =
      await this.systemConfigService.isPersonalSubscriptionEnabled();
    if (!isEnabled) {
      this.logger.log(
        'Subscriptions are globally disabled — skipping trial expiry checks',
      );
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
    const isEnabled =
      await this.systemConfigService.isPersonalSubscriptionEnabled();
    if (!isEnabled) {
      this.logger.log(
        'Subscriptions are globally disabled — skipping paid expiry checks',
      );
      return;
    }

    const now = new Date();

    // 1. Past-due plans whose grace days are over drop to Free. This runs
    //    before step 3, so a plan marked PAST_DUE tonight always keeps its
    //    features until at least the next run, even if its period ended long ago.
    const graceCutoff = new Date(now.getTime() - PAST_DUE_GRACE_DAYS * DAY_MS);
    const unpaid = await this.db.subscription.findMany({
      where: {
        status: SubscriptionStatus.PAST_DUE,
        currentPeriodEnd: { lte: graceCutoff },
      },
    });
    for (const sub of unpaid) {
      await this.downgradeToFree(sub.id, 'unpaid');
    }

    // 2. Cancelled plans drop to Free once the paid period (or, if they never
    //    paid, the trial) is over. A cancelled trial has no currentPeriodEnd,
    //    and used to stay CANCELLED on its paid plan forever.
    //    Free itself could be "cancelled" before cancelling Free was refused;
    //    those rows just go back to an active Free plan, with no message.
    await this.db.subscription.updateMany({
      where: {
        status: SubscriptionStatus.CANCELLED,
        plan: { key: PlanTier.FREE },
      },
      data: { status: SubscriptionStatus.ACTIVE, cancelledAt: null },
    });
    const cancelled = await this.db.subscription.findMany({
      where: {
        status: SubscriptionStatus.CANCELLED,
        plan: { key: { not: PlanTier.FREE } },
        OR: [
          { currentPeriodEnd: { lte: now } },
          { currentPeriodEnd: null, trialEndDate: { lte: now } },
          { currentPeriodEnd: null, trialEndDate: null },
        ],
      },
    });
    for (const sub of cancelled) {
      await this.downgradeToFree(sub.id, 'cancelled_period_ended');
    }

    // 3. Active paid plans whose month ended without a renewal become
    //    PAST_DUE: they keep their features for PAST_DUE_GRACE_DAYS while
    //    the user is asked to renew. Free subscriptions have no period end,
    //    so they never match.
    const lapsed = await this.db.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: { lte: now },
      },
      include: { plan: true },
    });
    for (const sub of lapsed) {
      if (sub.plan.priceMonthly === 0) continue;
      // Grace is measured from currentPeriodEnd. A period that ended more
      // than a day ago (rows from before this job existed, or runs missed
      // while the service was down) would otherwise lose its features the
      // moment it is marked, and be told to "renew by" a date already
      // gone — so its grace starts from now instead.
      const periodEnd =
        sub.currentPeriodEnd! < new Date(now.getTime() - DAY_MS)
          ? now
          : sub.currentPeriodEnd!;
      await this.db.subscription.update({
        where: { id: sub.id },
        data: {
          status: SubscriptionStatus.PAST_DUE,
          ...(periodEnd !== sub.currentPeriodEnd && {
            currentPeriodEnd: periodEnd,
          }),
        },
      });
      const graceEnds = this.accessEndsAt({
        ...sub,
        status: SubscriptionStatus.PAST_DUE,
        currentPeriodEnd: periodEnd,
      });
      await this.notifications.dispatch({
        userId: sub.userId,
        type: 'SUBSCRIPTION_PAST_DUE',
        title: `Renew your ${sub.plan.name} plan`,
        message:
          `Your ${sub.plan.name} month has ended. Renew by ` +
          `${graceEnds!.toISOString().slice(0, 10)} to keep your features; ` +
          'after that you move to the Free plan.',
        skipPush: false,
      });
    }

    this.logger.log(
      `Paid expiries: ${unpaid.length} unpaid → Free, ` +
        `${cancelled.length} cancelled → Free, ${lapsed.length} lapsed → past due`,
    );
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

    let updatedLimits = (existing.limits as Record<string, any>) || {};
    if (dto.limits) {
      updatedLimits = {
        ...updatedLimits,
        ...dto.limits,
      };
    }

    const updated = await this.db.plan.update({
      where: { key: planKey },
      data: {
        ...(dto.priceMonthly !== undefined && {
          priceMonthly: dto.priceMonthly,
        }),
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
    dto: {
      priceMonthly?: number;
      name?: string;
      isActive?: boolean;
      limits?: Record<string, any>;
    },
  ): Promise<Plan> {
    const result = await this.updatePlanDetails(planKey, dto);
    return result;
  }

  async getPlanByKey(planKey: PlanTier): Promise<Plan | null> {
    return this.db.plan.findUnique({ where: { key: planKey } });
  }

  async getActivePlans(): Promise<
    Array<Plan & { resolvedLimits: PlanLimits }>
  > {
    const plans = await this.db.plan.findMany({
      where: { isActive: true },
      orderBy: { priceMonthly: 'asc' },
    });

    return plans.map((p) => ({
      ...p,
      resolvedLimits: this.resolvePlanLimits(p),
    }));
  }

  async getAllPlansAdmin(): Promise<
    Array<Plan & { resolvedLimits: PlanLimits }>
  > {
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

    const isPaidPlan = sub.plan.priceMonthly > 0;
    const renewalOpensAt =
      isPaidPlan &&
      sub.status === SubscriptionStatus.ACTIVE &&
      sub.currentPeriodEnd
        ? new Date(
            sub.currentPeriodEnd.getTime() - RENEWAL_WINDOW_DAYS * DAY_MS,
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
      /** Whether the plan's features are unlocked right now. */
      hasPlanAccess: this.isEntitled(sub, now),
      /** When the plan's features stop unless paid for; null if nothing ends them. */
      accessEndsAt: this.accessEndsAt(sub),
      /** Whether paying for this same plan now is accepted (renew or resubscribe). */
      canRenew:
        isPaidPlan &&
        this.checkoutBlockedReason(sub, sub.plan.key, now) === null,
      /** For an active paid plan: when renewing the same plan opens. */
      renewalOpensAt,
    };
  }

  /**
   * Same day-of-month `months` later, clamped to the target month's last
   * day: 31 Jan + 1 month is 28/29 Feb, not 3 Mar as Date#setMonth gives.
   */
  private addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    const day = result.getDate();
    result.setDate(1);
    result.setMonth(result.getMonth() + months);
    const lastDay = new Date(
      result.getFullYear(),
      result.getMonth() + 1,
      0,
    ).getDate();
    result.setDate(Math.min(day, lastDay));
    return result;
  }
}
