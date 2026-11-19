import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationDispatcher } from '../notification/notification-dispatcher.service';
import {
  Plan,
  Prisma,
  Subscription,
  SubscriptionStatus,
} from '../generated/prisma/client';
import { WebhookResult } from './gateways/payment-gateway.interface';
import { WalletNestClient } from './gateways/wallet-nest.client';
import {
  PRORATION_ROUNDING_KOBO,
  SubscriptionsService,
  TRIAL_MONTHS,
  TRIAL_START_KOBO,
} from './subscriptions.service';

export interface ActivationOutcome {
  status: 'success' | 'already_processed' | 'rejected' | 'error';
  message?: string;
  userId?: string;
  planKey?: string;
}

type Refusal = { status: 'already_processed' | 'rejected'; message?: string };

/** What automatic renewal charges, as stored on the subscription. */
type Instrument = Pick<
  Subscription,
  | 'autoRenew'
  | 'paymentMethod'
  | 'savedCardId'
  | 'savedCardLabel'
  | 'walletMandateId'
>;

/**
 * Applies payments to subscriptions, whatever they came through: Paystack
 * forwarded by wallet-nest, a wallet payment, the direct gateway webhooks, or
 * the nightly renewal job. One path, so the amount, idempotency and
 * "does this payment still apply" checks can never drift between them.
 */
@Injectable()
export class SubscriptionPaymentsService {
  private readonly logger = new Logger(SubscriptionPaymentsService.name);

  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly db: DatabaseService,
    private readonly notifications: NotificationDispatcher,
    private readonly wallet: WalletNestClient,
  ) {}

  async activateFromPayment(
    result: WebhookResult,
    gateway: string,
  ): Promise<ActivationOutcome> {
    // Trust the signature for authenticity, but still confirm the customer actually
    // paid for the plan the metadata is asking us to grant.
    const plan = await this.db.plan.findUnique({
      where: { key: result.planKey },
    });
    if (!plan) {
      this.logger.error(
        `${gateway} webhook referenced unknown plan: ${result.planKey}`,
      );
      return { status: 'error', message: 'Unknown plan' };
    }

    const kind = result.checkoutKind ?? 'full';
    // A prorated upgrade only paid the difference for the rest of the period,
    // so it is checked against what is due when it lands (inside the
    // transaction below). A trial only paid the card check. Every other
    // payment must cover a full month.
    const minimum =
      kind === 'prorated_upgrade'
        ? 0
        : kind === 'trial'
          ? TRIAL_START_KOBO
          : plan.priceMonthly;
    if ((result.amountKobo ?? 0) < minimum) {
      this.logger.warn(
        `${gateway} webhook underpaid for ${result.planKey} (${kind}): paid ${result.amountKobo}, expected ${minimum} (ref: ${result.reference})`,
      );
      return {
        status: 'rejected',
        message: 'Amount does not cover plan price',
      };
    }

    let released: { cardId?: string; mandateId?: string } = {};
    let updated: Subscription;
    try {
      // Idempotency is enforced by the unique index on gatewayRef rather than a
      // read-then-write check — gateways retry, and two concurrent deliveries would
      // both pass a findFirst. Both writes share one transaction so a duplicate
      // reference rolls the upgrade back instead of extending the period again.
      // Tagged, not told apart by shape: a Subscription has a `status` too.
      const outcome = await this.db.$transaction<
        { refusal: Refusal } | { applied: Subscription }
      >(async (tx) => {
        let renewFrom: Date | undefined;
        if (kind === 'prorated_upgrade') {
          const refusal = await this.checkProratedUpgrade(
            tx,
            result,
            plan,
            gateway,
          );
          if (refusal) return { refusal };
        } else if (kind === 'trial') {
          const refusal = await this.checkTrialStart(tx, result, gateway);
          if (refusal) return { refusal };
        } else if (kind === 'renewal') {
          const checked = await this.checkRenewal(tx, result, gateway);
          if ('refusal' in checked) return checked;
          renewFrom = checked.anchor;
        }

        const before = await tx.subscription.findUnique({
          where: { userId: result.userId },
        });

        let sub = await this.subscriptionsService.upgradePlan(
          result.userId,
          result.planKey,
          result.reference,
          tx,
          kind === 'prorated_upgrade'
            ? { keepCurrentPeriod: true }
            : kind === 'trial'
              ? { startTrial: true }
              : kind === 'renewal'
                ? { renewFrom }
                : {},
        );

        if (kind !== 'renewal') {
          const next = SubscriptionPaymentsService.instrumentAfter(
            result,
            before,
          );
          if (next) {
            released = next.released;
            sub = await tx.subscription.update({
              where: { userId: result.userId },
              data: next.data,
            });
          }
        }

        await tx.paymentRecord.create({
          data: {
            subscriptionId: sub.id,
            amount: result.amountKobo,
            currency: 'NGN',
            status: 'success',
            gatewayRef: result.reference,
            paidAt: new Date(),
          },
        });
        return { applied: sub };
      });
      if ('refusal' in outcome) return outcome.refusal;
      updated = outcome.applied;
    } catch (err) {
      // Scoped to the gatewayRef index specifically: a unique violation on any other
      // column (e.g. userId while bootstrapping a subscription) is a real error, and
      // reporting it as already-processed would silently swallow a genuine payment.
      const target = err?.meta?.target;
      const isDuplicateRef =
        err?.code === 'P2002' &&
        (Array.isArray(target)
          ? target.includes('gatewayRef')
          : String(target ?? '').includes('gatewayRef'));

      if (isDuplicateRef) {
        this.logger.log(
          `Payment already processed for reference ${result.reference}`,
        );
        return { status: 'already_processed' };
      }
      this.logger.error(
        `Error activating subscription after ${gateway} webhook: ${err.message}`,
      );
      return { status: 'error', message: err.message };
    }

    await this.release(result.userId, released);
    await this.notifications.dispatch({
      userId: result.userId,
      ...SubscriptionPaymentsService.notice(kind, plan, updated),
      skipPush: false,
    });

    this.logger.log(
      `Successfully applied ${kind} payment for user ${result.userId} (${result.planKey}) via ${gateway} ref: ${result.reference}`,
    );
    return {
      status: 'success',
      userId: result.userId,
      planKey: result.planKey,
    };
  }

  /**
   * Stop renewing automatically (cancelling, or a card/permission that has
   * gone): clear it from the subscription and release it at wallet-nest.
   */
  async stopAutoRenew(userId: string): Promise<void> {
    const sub = await this.db.subscription.findUnique({ where: { userId } });
    if (!sub) return;
    await this.db.subscription.update({
      where: { userId },
      data: {
        autoRenew: false,
        paymentMethod: null,
        savedCardId: null,
        savedCardLabel: null,
        walletMandateId: null,
      },
    });
    await this.release(userId, {
      cardId: sub.savedCardId ?? undefined,
      mandateId: sub.walletMandateId ?? undefined,
    });
  }

  // ─── Checks, inside the activation transaction ────────────────────────────

  /**
   * Serialise activations for this user, and spot a redelivery of a payment
   * already applied: by then the subscription has moved on, so the checks
   * below would wrongly refuse it.
   */
  private async lockAndCheckSeen(
    tx: Prisma.TransactionClient,
    result: WebhookResult,
  ): Promise<Refusal | null> {
    await tx.$queryRaw`SELECT id FROM "Subscription" WHERE "userId" = ${result.userId} FOR UPDATE`;
    const seen = await tx.paymentRecord.findUnique({
      where: { gatewayRef: result.reference },
    });
    if (seen) {
      this.logger.log(
        `Payment already processed for reference ${result.reference}`,
      );
      return { status: 'already_processed' };
    }
    return null;
  }

  /**
   * Decide, inside the activation transaction, whether a prorated upgrade
   * payment can be applied. Returns an outcome to stop with, or null to go on.
   *
   * The payment was priced at checkout against the subscription as it was
   * then: its plan and its renewal date. If either has changed since (a
   * second upgrade paid in another tab, an early renewal, a lapse), the
   * payment no longer fits and is refused for a refund.
   *
   * If neither has changed, the amount due is recomputed for the time now
   * left and what was paid must cover it. Less time is left than at checkout,
   * so the fair difference has only shrunk, but each price is rounded to
   * whole kobo separately and the rounded difference can tick up by 1 kobo
   * as the ratio falls. That 1 kobo is allowed; anything more is refused.
   */
  private async checkProratedUpgrade(
    tx: Prisma.TransactionClient,
    result: WebhookResult,
    plan: Plan,
    gateway: string,
  ): Promise<Refusal | null> {
    const seen = await this.lockAndCheckSeen(tx, result);
    if (seen) return seen;

    const sub = await tx.subscription.findUnique({
      where: { userId: result.userId },
      include: { plan: true },
    });
    const due = sub
      ? this.subscriptionsService.prorationQuote(sub, plan)
      : null;

    const pricedEnd = result.pricedPeriodEnd
      ? new Date(result.pricedPeriodEnd).getTime()
      : NaN;
    if (
      !due ||
      due.fromPlanKey !== result.fromPlanKey ||
      due.periodEnd.getTime() !== pricedEnd
    ) {
      this.logger.error(
        `REFUND NEEDED: ${gateway} prorated upgrade to ${result.planKey} no longer applies ` +
          `(user ${result.userId}, now on ${sub?.plan.key ?? 'no plan'} / ${sub?.status ?? '-'} ` +
          `until ${sub?.currentPeriodEnd?.toISOString() ?? '-'}, priced from ${result.fromPlanKey} ` +
          `until ${result.pricedPeriodEnd ?? '-'}; paid ${result.amountKobo}, ref: ${result.reference})`,
      );
      return {
        status: 'rejected',
        message:
          'The subscription changed after this upgrade was priced; the payment needs a refund',
      };
    }

    if ((result.amountKobo ?? 0) < due.amountKobo - PRORATION_ROUNDING_KOBO) {
      // Checkout sets the amount server-side, so this is a tampered or
      // hand-made charge rather than a customer mistake — still money taken
      // with nothing granted.
      this.logger.error(
        `REFUND NEEDED: ${gateway} prorated upgrade underpaid for ${result.planKey}: ` +
          `paid ${result.amountKobo}, due ${due.amountKobo} (user ${result.userId}, ref: ${result.reference})`,
      );
      return {
        status: 'rejected',
        message: 'Amount does not cover the prorated upgrade',
      };
    }
    return null;
  }

  /**
   * A trial starts once per account: the same eligibility the quote used
   * must still hold, or this is a second trial check paid in another tab.
   */
  private async checkTrialStart(
    tx: Prisma.TransactionClient,
    result: WebhookResult,
    gateway: string,
  ): Promise<Refusal | null> {
    const seen = await this.lockAndCheckSeen(tx, result);
    if (seen) return seen;

    const sub = await tx.subscription.findUnique({
      where: { userId: result.userId },
      include: { plan: true },
    });
    const paidBefore = sub
      ? await tx.paymentRecord.count({
          where: { subscriptionId: sub.id, status: 'success' },
        })
      : 0;
    const eligible =
      !sub ||
      (!sub.trialUsed &&
        !(
          sub.plan.priceMonthly > 0 && this.subscriptionsService.isEntitled(sub)
        ) &&
        paidBefore === 0);
    if (!eligible) {
      this.logger.error(
        `REFUND NEEDED: ${gateway} trial start for ${result.planKey} no longer applies ` +
          `(user ${result.userId}, on ${sub?.plan.key} / ${sub?.status}, trialUsed=${sub?.trialUsed}; ` +
          `paid ${result.amountKobo}, ref: ${result.reference})`,
      );
      return {
        status: 'rejected',
        message:
          'A trial has already been used on this account; the payment needs a refund',
      };
    }
    return null;
  }

  /**
   * An automatic renewal renews the period (or trial) that was ending when
   * it was charged. If the plan or that date has changed since (the user
   * paid by hand meanwhile, or cancelled), it no longer fits.
   */
  private async checkRenewal(
    tx: Prisma.TransactionClient,
    result: WebhookResult,
    gateway: string,
  ): Promise<{ refusal: Refusal } | { anchor: Date }> {
    const seen = await this.lockAndCheckSeen(tx, result);
    if (seen) return { refusal: seen };

    const sub = await tx.subscription.findUnique({
      where: { userId: result.userId },
      include: { plan: true },
    });
    const anchor = sub ? this.subscriptionsService.renewalAnchor(sub) : null;
    const renewable =
      sub &&
      anchor &&
      sub.plan.key === result.planKey &&
      anchor.getTime() === Date.parse(result.pricedPeriodEnd ?? '') &&
      (
        [
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.TRIALING,
          SubscriptionStatus.PAST_DUE,
        ] as SubscriptionStatus[]
      ).includes(sub.status);
    if (!renewable) {
      this.logger.error(
        `REFUND NEEDED: ${gateway} renewal of ${result.planKey} from ${result.pricedPeriodEnd ?? '-'} ` +
          `no longer applies (user ${result.userId}, now on ${sub?.plan.key ?? 'no plan'} / ` +
          `${sub?.status ?? '-'} renewing ${anchor?.toISOString() ?? '-'}; ` +
          `paid ${result.amountKobo}, ref: ${result.reference})`,
      );
      return {
        refusal: {
          status: 'rejected',
          message:
            'The subscription changed after this renewal was charged; the payment needs a refund',
        },
      };
    }
    return { anchor: anchor! };
  }

  // ─── Payment methods ──────────────────────────────────────────────────────

  /**
   * What a payment does to automatic renewal. It uses what this payment set
   * up (the card wallet-nest saved, or the wallet mandate granted with it),
   * or stops renewing if the user said no. Whatever it replaces is released
   * after the transaction. Null leaves it as it was: the user asked to
   * renew, but the card couldn't be saved (e.g. a one-time card).
   */
  static instrumentAfter(
    result: WebhookResult,
    before: Instrument | null,
  ): {
    data: Instrument;
    released: { cardId?: string; mandateId?: string };
  } | null {
    const oldCard = before?.savedCardId ?? undefined;
    const oldMandate = before?.walletMandateId ?? undefined;

    if (result.paymentMethod === 'WALLET' && result.walletMandateId) {
      return {
        data: {
          autoRenew: true,
          paymentMethod: 'WALLET',
          walletMandateId: result.walletMandateId,
          savedCardId: null,
          savedCardLabel: null,
        },
        released: {
          cardId: oldCard,
          mandateId:
            oldMandate !== result.walletMandateId ? oldMandate : undefined,
        },
      };
    }
    if (result.paymentMethod !== 'WALLET' && result.savedCard) {
      return {
        data: {
          autoRenew: true,
          paymentMethod: 'CARD',
          savedCardId: result.savedCard.id,
          savedCardLabel: WalletNestClient.cardLabel(result.savedCard),
          walletMandateId: null,
        },
        released: {
          cardId: oldCard !== result.savedCard.id ? oldCard : undefined,
          mandateId: oldMandate,
        },
      };
    }
    if (!result.autoRenew) {
      return {
        data: {
          autoRenew: false,
          paymentMethod: null,
          savedCardId: null,
          savedCardLabel: null,
          walletMandateId: null,
        },
        released: { cardId: oldCard, mandateId: oldMandate },
      };
    }
    return null;
  }

  /** Best-effort: a card or mandate left behind is harmless once unreferenced. */
  private async release(
    userId: string,
    { cardId, mandateId }: { cardId?: string; mandateId?: string },
  ): Promise<void> {
    if (cardId) {
      await this.wallet
        .removeSavedCard(cardId, userId)
        .catch((err) =>
          this.logger.warn(
            `Could not remove saved card ${cardId}: ${err.message}`,
          ),
        );
    }
    if (mandateId) {
      await this.wallet
        .revokeMandate(mandateId, userId)
        .catch((err) =>
          this.logger.warn(
            `Could not revoke wallet mandate ${mandateId}: ${err.message}`,
          ),
        );
    }
  }

  private static notice(
    kind: WebhookResult['checkoutKind'],
    plan: Plan,
    sub: Subscription,
  ): { type: 'SUBSCRIPTION_ACTIVATED'; title: string; message: string } {
    const day = (d: Date | null | undefined) =>
      d ? d.toISOString().slice(0, 10) : '';
    const price = `₦${(plan.priceMonthly / 100).toLocaleString('en-NG')}`;
    switch (kind) {
      case 'trial':
        return {
          type: 'SUBSCRIPTION_ACTIVATED',
          title: 'Your free trial has started',
          message: sub.autoRenew
            ? `Enjoy ${TRIAL_MONTHS} months of ${plan.name}. We'll charge ${price} on ${day(sub.trialEndDate)}, then monthly, unless you cancel.`
            : `Enjoy ${TRIAL_MONTHS} months of ${plan.name}, until ${day(sub.trialEndDate)}.`,
        };
      case 'renewal':
        return {
          type: 'SUBSCRIPTION_ACTIVATED',
          title: `${plan.name} renewed`,
          message: `We took ${price} and your plan now runs until ${day(sub.currentPeriodEnd)}.`,
        };
      case 'prorated_upgrade':
        return {
          type: 'SUBSCRIPTION_ACTIVATED',
          title: `You're on ${plan.name}`,
          message: `Your upgrade is active. Your renewal date stays ${day(sub.currentPeriodEnd)}.`,
        };
      default:
        return {
          type: 'SUBSCRIPTION_ACTIVATED',
          title: 'Subscription Activated! 🎉',
          message: `Your ${plan.name} plan is active until ${day(sub.currentPeriodEnd)}.`,
        };
    }
  }
}
