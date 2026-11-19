import {
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { NotificationDispatcher } from '../notification/notification-dispatcher.service';
import { SystemConfigService } from '../system-config/system-config.service';
import {
  Plan,
  Subscription,
  SubscriptionStatus,
} from '../generated/prisma/client';
import {
  AutoChargeResult,
  WalletNestClient,
} from './gateways/wallet-nest.client';
import {
  DAY_MS,
  renewalInstrument,
  SubscriptionsService,
} from './subscriptions.service';
import { SubscriptionPaymentsService } from './subscription-payments.service';

/** Automatic charges are first tried this long before the renewal date. */
export const RENEWAL_LEAD_DAYS = 1;
/** The heads-up before an automatic charge is sent this many days ahead. */
export const RENEWAL_REMINDER_DAYS = 3;
/** At most one automatic charge attempt per subscription in this window. */
const RETRY_GAP_MS = 20 * 60 * 60 * 1000;
/** Paystack charge statuses that are not an answer yet. */
const PENDING_CHARGE_STATUSES = ['pending', 'ongoing', 'processing', 'queued'];

type SubWithPlan = Subscription & { plan: Plan };

/**
 * The nightly billing run. Order matters, so it is one job:
 *
 * 1. Remind users whose card or wallet will be charged in RENEWAL_REMINDER_DAYS.
 * 2. Charge automatic renewals due within RENEWAL_LEAD_DAYS (or already in
 *    their grace days), extending from the renewal date, not from today.
 * 3. End trials, then paid periods, that weren't renewed: a plan renewed in
 *    step 2 must never be marked past due or expired by steps 3–4.
 */
@Injectable()
export class SubscriptionRenewalService {
  private readonly logger = new Logger(SubscriptionRenewalService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly subscriptions: SubscriptionsService,
    private readonly payments: SubscriptionPaymentsService,
    private readonly wallet: WalletNestClient,
    private readonly notifications: NotificationDispatcher,
    private readonly systemConfig: SystemConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async runNightly(): Promise<void> {
    if (!(await this.systemConfig.isPersonalSubscriptionEnabled())) {
      this.logger.log(
        'Subscriptions are globally disabled — skipping billing run',
      );
      return;
    }
    const now = new Date();
    await this.sendRenewalReminders(now);
    await this.chargeDueRenewals(now);
    await this.subscriptions.processTrialExpiries();
    await this.subscriptions.processPaidExpiries();
  }

  // ─── Reminders ────────────────────────────────────────────────────────────

  async sendRenewalReminders(now = new Date()): Promise<number> {
    const horizon = new Date(now.getTime() + RENEWAL_REMINDER_DAYS * DAY_MS);
    const due = await this.db.subscription.findMany({
      where: {
        autoRenew: true,
        OR: [
          {
            status: SubscriptionStatus.ACTIVE,
            currentPeriodEnd: { gt: now, lte: horizon },
          },
          {
            status: SubscriptionStatus.TRIALING,
            trialEndDate: { gt: now, lte: horizon },
          },
        ],
      },
      include: { plan: true },
    });

    let sent = 0;
    for (const sub of due) {
      const anchor = this.subscriptions.renewalAnchor(sub);
      if (
        !anchor ||
        sub.plan.priceMonthly === 0 ||
        !renewalInstrument(sub) ||
        sub.renewalReminderFor?.getTime() === anchor.getTime()
      ) {
        continue;
      }
      await this.notifications.dispatch({
        userId: sub.userId,
        type: 'SUBSCRIPTION_RENEWAL_REMINDER',
        title: `${sub.plan.name} renews on ${SubscriptionRenewalService.day(anchor)}`,
        message:
          `We'll charge ${SubscriptionRenewalService.naira(sub.plan.priceMonthly)} to ` +
          `${SubscriptionRenewalService.instrumentLabel(sub)} on ` +
          `${SubscriptionRenewalService.day(anchor)}. To stop it, cancel on your plan page before then.`,
        skipPush: false,
      });
      await this.db.subscription.update({
        where: { id: sub.id },
        data: { renewalReminderFor: anchor },
      });
      sent++;
    }
    return sent;
  }

  // ─── Charges ──────────────────────────────────────────────────────────────

  async chargeDueRenewals(now = new Date()): Promise<void> {
    const dueBy = new Date(now.getTime() + RENEWAL_LEAD_DAYS * DAY_MS);
    const due = await this.db.subscription.findMany({
      where: {
        autoRenew: true,
        OR: [
          {
            status: SubscriptionStatus.ACTIVE,
            currentPeriodEnd: { lte: dueBy },
          },
          {
            status: SubscriptionStatus.TRIALING,
            trialEndDate: { lte: dueBy },
          },
          { status: SubscriptionStatus.PAST_DUE },
        ],
      },
      include: { plan: true },
    });

    let renewed = 0;
    for (const sub of due) {
      try {
        if (await this.renew(sub, now)) renewed++;
      } catch (err) {
        this.logger.error(
          `Renewal of ${sub.id} crashed; will retry next run: ${err.message}`,
        );
      }
    }
    this.logger.log(
      `Automatic renewals: ${renewed} of ${due.length} due charged`,
    );
  }

  /** Charge one subscription's renewal. True if it renewed. */
  async renew(sub: SubWithPlan, now = new Date()): Promise<boolean> {
    const method = renewalInstrument(sub);
    const anchor = this.subscriptions.renewalAnchor(sub);
    if (!method || !anchor || sub.plan.priceMonthly === 0) return false;
    // Past its grace days: the expiry step moves it to Free instead.
    if (
      sub.status === SubscriptionStatus.PAST_DUE &&
      !this.subscriptions.isEntitled(sub, now)
    ) {
      return false;
    }
    if (
      sub.lastRenewalAttemptAt &&
      now.getTime() - sub.lastRenewalAttemptAt.getTime() < RETRY_GAP_MS
    ) {
      return false;
    }

    const attempt = sub.renewalAttempts + 1;
    // Stable per period for the wallet, so a retry after a crash can never
    // charge twice; per attempt for cards, since Paystack refuses a reference
    // it has already declined.
    const base = `SUBR_${sub.id}_${anchor.toISOString().slice(0, 10).replace(/-/g, '')}`;
    const reference = method === 'WALLET' ? base : `${base}_${attempt}`;
    const metadata = {
      userId: sub.userId,
      planKey: sub.plan.key,
      checkoutKind: 'renewal',
      anchor: anchor.toISOString(),
    };

    await this.db.subscription.update({
      where: { id: sub.id },
      data: { renewalAttempts: attempt, lastRenewalAttemptAt: now },
    });

    let charge: AutoChargeResult;
    try {
      charge =
        method === 'WALLET'
          ? await this.wallet.chargeMandate({
              mandateId: sub.walletMandateId!,
              userId: sub.userId,
              amountKobo: sub.plan.priceMonthly,
              reference,
              description: `Connect ${sub.plan.name} plan renewal`,
              metadata,
            })
          : await this.wallet.chargeSavedCard(sub.savedCardId!, {
              userId: sub.userId,
              amountKobo: sub.plan.priceMonthly,
              reference,
              metadata,
            });
    } catch (err) {
      if (err instanceof NotFoundException) {
        // The card was removed, or the wallet permission revoked, elsewhere.
        await this.payments.stopAutoRenew(sub.userId);
        await this.notifications.dispatch({
          userId: sub.userId,
          type: 'SUBSCRIPTION_RENEWAL_FAILED',
          title: `Automatic renewal of ${sub.plan.name} is off`,
          message:
            `The ${method === 'WALLET' ? 'wallet permission' : 'saved card'} for your plan ` +
            `is no longer available. Renew on your plan page by ` +
            `${SubscriptionRenewalService.day(anchor)} to keep your features.`,
          skipPush: false,
        });
        return false;
      }
      // Refused outright (an amount over what the wallet permission allows,
      // a payment still in flight): nothing was taken, so it's a decline.
      if (err instanceof HttpException && err.getStatus() < 500) {
        charge = { status: 'failed', reference, reason: err.message };
      } else {
        throw err;
      }
    }

    if (PENDING_CHARGE_STATUSES.includes(charge.status)) {
      // Paystack is still deciding: its webhook applies the renewal if it
      // goes through, and this job tries again tomorrow if it doesn't.
      this.logger.log(
        `Renewal pending | sub=${sub.id} ref=${reference}: ${charge.status}`,
      );
      return false;
    }

    if (charge.status !== 'success') {
      this.logger.warn(
        `Renewal declined | sub=${sub.id} ref=${reference} attempt=${attempt}: ${charge.reason ?? charge.status}`,
      );
      // Tell them once per period; the job keeps trying through the grace days.
      if (attempt === 1) {
        await this.notifications.dispatch({
          userId: sub.userId,
          type: 'SUBSCRIPTION_RENEWAL_FAILED',
          title: `We couldn't renew ${sub.plan.name}`,
          message:
            `Charging ${SubscriptionRenewalService.naira(sub.plan.priceMonthly)} to ` +
            `${SubscriptionRenewalService.instrumentLabel(sub)} didn't go through` +
            `${charge.reason ? ` (${charge.reason})` : ''}. We'll try again tomorrow, ` +
            'or you can renew on your plan page.',
          skipPush: false,
        });
      }
      return false;
    }

    const outcome = await this.payments.activateFromPayment(
      {
        success: true,
        userId: sub.userId,
        planKey: sub.plan.key,
        reference: charge.reference,
        amountKobo: sub.plan.priceMonthly,
        checkoutKind: 'renewal',
        pricedPeriodEnd: anchor.toISOString(),
        paymentMethod: method,
      },
      method === 'WALLET' ? 'Wallet renewal' : 'Card renewal',
    );
    // A card charge's own webhook may have landed first: already applied.
    return (
      outcome.status === 'success' || outcome.status === 'already_processed'
    );
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private static instrumentLabel(
    sub: Pick<Subscription, 'paymentMethod' | 'savedCardLabel'>,
  ) {
    return sub.paymentMethod === 'WALLET'
      ? 'your Fiscus wallet'
      : (sub.savedCardLabel ?? 'your saved card');
  }

  private static naira(kobo: number): string {
    return `₦${(kobo / 100).toLocaleString('en-NG')}`;
  }

  private static day(d: Date): string {
    return d.toISOString().slice(0, 10);
  }
}
