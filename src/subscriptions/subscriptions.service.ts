import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
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

/** Smallest charge sent to Paystack: ₦50, what wallet-nest's own card check charges. */
export const MIN_CHARGE_KOBO = 5_000;

/**
 * How far the prorated difference can rise as time passes. Each price is
 * rounded separately, so round(new × r) − round(old × r) is off the exact
 * value by less than 1 kobo either way: as r falls, the rounded difference
 * can go up by at most 1 kobo before the shrinking exact value outweighs it.
 */
export const PRORATION_ROUNDING_KOBO = 1;

/** How long a free trial of a paid plan lasts. */
export const TRIAL_MONTHS = 6;

/**
 * Charged to start a trial, to check the card (or wallet) that the first
 * month will be taken from when the trial ends. Not refunded.
 */
export const TRIAL_START_KOBO = MIN_CHARGE_KOBO;

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Anything that isn't a trial, a renewal or a prorated upgrade is a `full` payment. */
export type CheckoutKind = 'full' | 'prorated_upgrade' | 'trial' | 'renewal';
export const CHECKOUT_KINDS: readonly CheckoutKind[] = [
  'full',
  'prorated_upgrade',
  'trial',
  'renewal',
];

/** What a checkout for a plan will charge, and what the payment buys. */
export interface CheckoutQuote {
  /**
   * `prorated_upgrade`: a mid-cycle move to a dearer plan; charges the
   * difference for the time left and keeps the renewal date.
   * `trial`: a first paid plan starts with a TRIAL_MONTHS free trial;
   * TRIAL_START_KOBO checks the payment method, and the first month is
   * charged to it when the trial ends.
   * `full`: one month at the plan's price.
   */
  kind: Exclude<CheckoutKind, 'renewal'>;
  planKey: PlanTier;
  amountKobo: number;
  /** The plan's monthly price, charged in full from the next month on. */
  fullPriceKobo: number;
  /** The plan being upgraded from; set only for a prorated upgrade. */
  fromPlanKey: PlanTier | null;
  /** When the paid period (or the trial) will end once this payment lands. */
  renewsAt: Date;
}

/** How a subscription renews itself, for /me and the renewal job. */
export type PaymentMethod = 'CARD' | 'WALLET';

/**
 * What an automatic renewal would charge, or null if it won't renew by
 * itself: renewing is on, and the card or wallet permission for the chosen
 * method is on file.
 */
export function renewalInstrument(
  sub: Pick<
    Subscription,
    'autoRenew' | 'paymentMethod' | 'savedCardId' | 'walletMandateId'
  >,
): PaymentMethod | null {
  if (!sub.autoRenew) return null;
  if (sub.paymentMethod === 'WALLET' && sub.walletMandateId) return 'WALLET';
  if (sub.paymentMethod === 'CARD' && sub.savedCardId) return 'CARD';
  return null;
}

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
    const trialing = sub.status === SubscriptionStatus.TRIALING;
    if (
      sub.plan.key !== planKey ||
      (sub.status !== SubscriptionStatus.ACTIVE && !trialing)
    ) {
      return null;
    }
    const end = this.coveredUntil(sub);
    if (!end) return null;
    const renewalOpensAt = new Date(
      end.getTime() - RENEWAL_WINDOW_DAYS * DAY_MS,
    );
    if (now >= renewalOpensAt) return null;

    const day = (d: Date) => d.toISOString().slice(0, 10);
    return trialing
      ? `You're on a free trial of ${sub.plan.name} until ${day(end)}. ` +
          `You can pay for it from ${day(renewalOpensAt)}.`
      : `You're already on ${sub.plan.name} until ${day(end)}. ` +
          `You can renew from ${day(renewalOpensAt)}.`;
  }

  /**
   * The end of the time already paid for, or trialled, on the current plan:
   * paying again for the same plan adds a month after it, so none is lost.
   * Unlike accessEndsAt, a past-due plan's grace days don't count.
   */
  private coveredUntil(sub: LifecycleFields): Date | null {
    return sub.status === SubscriptionStatus.PAST_DUE
      ? (sub.currentPeriodEnd ?? null)
      : this.accessEndsAt(sub);
  }

  /**
   * A user's first paid plan starts with a free trial: they have never had
   * one, aren't on a paid plan now, and have never paid for one.
   */
  async isTrialEligible(
    sub: LifecycleFields & {
      id: string;
      trialUsed: boolean;
      plan: Pick<Plan, 'priceMonthly'>;
    },
    now = new Date(),
  ): Promise<boolean> {
    if (sub.trialUsed) return false;
    if (sub.plan.priceMonthly > 0 && this.isEntitled(sub, now)) return false;
    const paid = await this.db.paymentRecord.count({
      where: { subscriptionId: sub.id, status: 'success' },
    });
    return paid === 0;
  }

  /**
   * The date an automatic charge renews from: the end of the trial for a
   * trial, else the end of the paid period. Null if nothing is scheduled.
   */
  renewalAnchor(
    sub: Pick<Subscription, 'status' | 'currentPeriodEnd' | 'trialEndDate'>,
  ): Date | null {
    return sub.status === SubscriptionStatus.TRIALING
      ? (sub.trialEndDate ?? null)
      : (sub.currentPeriodEnd ?? null);
  }

  /** Whether the paid period is still running (so its unused time is worth something). */
  private hasPaidTimeLeft(sub: LifecycleFields, now: Date): boolean {
    return (
      (sub.status === SubscriptionStatus.ACTIVE ||
        sub.status === SubscriptionStatus.CANCELLED) &&
      sub.currentPeriodEnd !== null &&
      sub.currentPeriodEnd > now
    );
  }

  /**
   * The prorated charge for moving mid-cycle to a dearer plan, or null when
   * the move is not a prorated upgrade (no paid time left, same plan,
   * cheaper plan, or coming from Free).
   *
   * The renewal date is the anchor and does not move. The user is credited
   * the unused share of the old plan and charged the same share of the new
   * one, each rounded to whole kobo:
   *
   *   ratio  = time left / one billing month (the month ending on the anchor)
   *   charge = round(newPrice × ratio) − round(oldPrice × ratio)
   *
   * The month is measured as the one that ends on the anchor rather than
   * currentPeriodEnd − currentPeriodStart, because an early renewal extends
   * the period without moving its start: over a two-month span, dividing by
   * the whole span would halve the credit. With a month as the unit, time
   * left beyond one month is credited at the full monthly rate.
   */
  prorationQuote(
    sub: LifecycleFields & { plan: Pick<Plan, 'key' | 'priceMonthly'> },
    target: Pick<Plan, 'key' | 'priceMonthly'>,
    now = new Date(),
  ): { amountKobo: number; fromPlanKey: PlanTier; periodEnd: Date } | null {
    if (
      sub.plan.key === target.key ||
      sub.plan.priceMonthly <= 0 ||
      target.priceMonthly <= sub.plan.priceMonthly ||
      !this.hasPaidTimeLeft(sub, now)
    ) {
      return null;
    }
    const periodEnd = sub.currentPeriodEnd!;
    const monthMs =
      periodEnd.getTime() - this.addMonths(periodEnd, -1).getTime();
    const ratio = (periodEnd.getTime() - now.getTime()) / monthMs;

    const unusedCredit = Math.round(sub.plan.priceMonthly * ratio);
    const newCost = Math.round(target.priceMonthly * ratio);
    return {
      // Paystack rejects very small charges; ₦50 is what wallet-nest's own
      // card check charges. In the last few days of a cycle the fair delta
      // falls below that and is rounded up to it.
      amountKobo: Math.max(MIN_CHARGE_KOBO, newCost - unusedCredit),
      fromPlanKey: sub.plan.key,
      periodEnd,
    };
  }

  /**
   * What a checkout for `target` charges, or a 409 when it must not start:
   * - the plan the user already has, outside the renewal window (a double
   *   payment);
   * - a cheaper plan while paid time is left (it would forfeit that time;
   *   downgrades are not offered yet).
   * A mid-cycle move to a dearer plan is prorated and keeps the renewal
   * date; anything else is the full monthly price.
   */
  quoteCheckout(
    sub: LifecycleFields & {
      plan: Pick<Plan, 'key' | 'name' | 'priceMonthly'>;
    },
    target: Pick<Plan, 'key' | 'name' | 'priceMonthly'>,
    now = new Date(),
    options: {
      /** From isTrialEligible: this user's first paid plan starts with a trial. */
      trialEligible?: boolean;
    } = {},
  ): CheckoutQuote {
    const blocked = this.checkoutBlockedReason(sub, target.key, now);
    if (blocked) throw new ConflictException(blocked);

    if (
      sub.plan.key !== target.key &&
      target.priceMonthly < sub.plan.priceMonthly &&
      this.hasPaidTimeLeft(sub, now)
    ) {
      throw new ConflictException(
        `Moving to ${target.name} isn't available while your ${sub.plan.name} ` +
          `plan has paid time left (until ${sub.currentPeriodEnd!.toISOString().slice(0, 10)}).`,
      );
    }

    if (options.trialEligible) {
      return {
        kind: 'trial',
        planKey: target.key,
        amountKobo: TRIAL_START_KOBO,
        fullPriceKobo: target.priceMonthly,
        fromPlanKey: null,
        renewsAt: this.addMonths(now, TRIAL_MONTHS),
      };
    }

    const prorated = this.prorationQuote(sub, target, now);
    if (prorated) {
      return {
        kind: 'prorated_upgrade',
        planKey: target.key,
        amountKobo: prorated.amountKobo,
        fullPriceKobo: target.priceMonthly,
        fromPlanKey: prorated.fromPlanKey,
        renewsAt: prorated.periodEnd,
      };
    }
    // Mirrors upgradePlan: the same plan with paid or trial time left extends
    // from where that ends; anything else starts a month from today.
    const end = this.coveredUntil(sub);
    const extendsCurrent = sub.plan.key === target.key && !!end && end > now;
    return {
      kind: 'full',
      planKey: target.key,
      amountKobo: target.priceMonthly,
      fullPriceKobo: target.priceMonthly,
      fromPlanKey: null,
      renewsAt: this.addMonths(extendsCurrent ? end : now, 1),
    };
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
    options: {
      /**
       * A prorated mid-cycle upgrade: switch plans now and keep the period
       * (and its renewal date) exactly as it is — the payment only covered
       * the difference for the time left.
       */
      keepCurrentPeriod?: boolean;
      /**
       * An automatic renewal: the next month runs from this anchor (the end
       * of the period or trial being renewed), not from today, so a charge
       * taken a day early or during the grace days never moves the date.
       */
      renewFrom?: Date;
      /** Start the TRIAL_MONTHS free trial of `newPlanKey` today. */
      startTrial?: boolean;
    } = {},
  ): Promise<Subscription> {
    const db = tx ?? this.db;

    let sub = await db.subscription.findUnique({ where: { userId } });
    if (!sub) {
      sub = await this.createSubscription(userId, PlanTier.FREE, true);
    }

    const plan = await db.plan.findUnique({ where: { key: newPlanKey } });
    if (!plan) throw new NotFoundException(`Plan not found: ${newPlanKey}`);

    if (options.startTrial) {
      const now = new Date();
      return db.subscription.update({
        where: { userId },
        data: {
          planId: plan.id,
          status: SubscriptionStatus.TRIALING,
          trialStartDate: now,
          trialEndDate: this.addMonths(now, TRIAL_MONTHS),
          trialUsed: true,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          cancelledAt: null,
          ...SubscriptionsService.NEW_RENEWAL_DATE,
          gatewaySubId,
        },
      });
    }

    if (options.renewFrom) {
      return db.subscription.update({
        where: { userId },
        data: {
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: options.renewFrom,
          currentPeriodEnd: this.addMonths(options.renewFrom, 1),
          cancelledAt: null,
          ...SubscriptionsService.NEW_RENEWAL_DATE,
          gatewaySubId,
        },
      });
    }

    if (options.keepCurrentPeriod) {
      return db.subscription.update({
        where: { userId },
        data: {
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          gatewaySubId,
          cancelledAt: null,
        },
      });
    }

    const now = new Date();

    // Paying again for the same plan before its period or trial ends (an
    // early renewal, or resubscribing after cancelling) adds a month to the
    // end already covered, so no paid or trial days are lost. A different
    // plan, or a lapsed one, starts a fresh month today.
    const coveredUntil = this.coveredUntil(sub);
    const extendsCurrentPeriod =
      sub.planId === plan.id && !!coveredUntil && coveredUntil > now;
    const periodBase = extendsCurrentPeriod ? coveredUntil : now;

    return db.subscription.update({
      where: { userId },
      data: {
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        gatewaySubId,
        cancelledAt: null,
        currentPeriodStart: extendsCurrentPeriod
          ? (sub.currentPeriodStart ?? coveredUntil)
          : now,
        currentPeriodEnd: this.addMonths(periodBase, 1),
        ...SubscriptionsService.NEW_RENEWAL_DATE,
      },
    });
  }

  /**
   * The renewal date moved: the failed attempts counted so far belonged to
   * the old one, and the first decline for the new one must be announced.
   */
  private static readonly NEW_RENEWAL_DATE = {
    renewalAttempts: 0,
    lastRenewalAttemptAt: null,
  } as const;

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

    // Cancelling stops automatic renewal too; the saved card or wallet
    // permission itself is released by the caller (SubscriptionPaymentsService).
    return this.db.subscription.update({
      where: { userId },
      data: {
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
        autoRenew: false,
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

    // A trial set to renew whose first charge hasn't gone through yet (the
    // renewal job tries from the day before it ends) gets the same grace
    // days as an unpaid month, with retries, before it drops to Free.
    const willRenew = sub.plan.priceMonthly > 0 && !!renewalInstrument(sub);
    if (willRenew && sub.trialEndDate) {
      await this.db.subscription.update({
        where: { id: sub.id },
        data: {
          status: SubscriptionStatus.PAST_DUE,
          currentPeriodEnd: sub.trialEndDate,
        },
      });
      const graceEnds = new Date(
        sub.trialEndDate.getTime() + PAST_DUE_GRACE_DAYS * DAY_MS,
      );
      await this.notifications.dispatch({
        userId: sub.userId,
        type: 'SUBSCRIPTION_PAST_DUE',
        title: `Your ${sub.plan.name} trial has ended`,
        message:
          "We couldn't take the first month's payment yet. We'll try again, " +
          `or you can pay on your plan page by ${graceEnds.toISOString().slice(0, 10)} ` +
          'to keep your features.',
        skipPush: false,
      });
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

  /**
   * Run nightly by SubscriptionRenewalService.runNightly, after automatic
   * renewals have been charged, so a renewed plan is never marked expired.
   */
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

  /** Run nightly by SubscriptionRenewalService.runNightly, after renewals and trial expiries. */
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

  /**
   * Build the response shape for GET /subscriptions/me. `trialEligible`
   * comes from isTrialEligible, which needs a query of its own.
   */
  buildSubscriptionResponse(
    sub: Subscription & { plan: Plan },
    extra: { trialEligible?: boolean } = {},
  ) {
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
    const willAutoRenew =
      isPaidPlan &&
      !!renewalInstrument(sub) &&
      (sub.status === SubscriptionStatus.ACTIVE ||
        sub.status === SubscriptionStatus.TRIALING ||
        sub.status === SubscriptionStatus.PAST_DUE);
    const coveredUntil = this.coveredUntil(sub);
    const renewalOpensAt =
      isPaidPlan &&
      (sub.status === SubscriptionStatus.ACTIVE || isInTrial) &&
      coveredUntil
        ? new Date(coveredUntil.getTime() - RENEWAL_WINDOW_DAYS * DAY_MS)
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
      /** For an active paid plan or a trial: when paying for the same plan opens. */
      renewalOpensAt,
      /** Whether the plan renews itself by charging the saved card or wallet. */
      autoRenew: willAutoRenew,
      /** What automatic renewals charge: CARD or WALLET, or null. */
      paymentMethod: willAutoRenew
        ? ((sub.paymentMethod as PaymentMethod | null) ?? null)
        : null,
      /** e.g. "visa •••• 4081" for a card; null for the wallet. */
      savedCardLabel: willAutoRenew ? (sub.savedCardLabel ?? null) : null,
      /** When the next automatic charge is due, and how much it takes. */
      nextChargeAt: willAutoRenew ? this.renewalAnchor(sub) : null,
      nextChargeKobo: willAutoRenew ? sub.plan.priceMonthly : null,
      /** Whether choosing a paid plan starts a free trial instead of charging a month. */
      trialEligible: extra.trialEligible ?? false,
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
