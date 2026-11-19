# STRICT — Subscriptions & billing (Connect personal; CP org plans in `connect-plus/subscriptions`)

**STRICT**: do not change public interfaces, security behaviour or data handling without stating the change and the reason in the plan / PR description.

- Plans: FREE / PRO_LITE / PRO_PLUS. Limits live in `plan-limits.config.ts` (`PLAN_LIMITS`) and DB `Plan` rows (price is DB-driven, admin-editable). Enforce with `PlanLimitGuard`/`@PlanFeature` and service-level `checkLimit()`.
- Payments go through the gateway adapter (`PaymentGatewayProvider`/`Factory`: Paystack, Paydestal) and card payments via `wallet-nest`. Never call a gateway SDK from a controller.
- Webhooks (`payment-webhook.controller.ts`): verify signature on raw body, idempotent on payment reference, record `PaymentRecord`, then upgrade. A payment must never be double-applied (see git history: "stop double payments").
- Lifecycle is covered by crons and specs: `TRIALING → EXPIRED → FREE`, grace period, cancel-keeps-access-until-period-end, prorated upgrades keep renewal date, auto-renew from saved card/wallet. Read `subscription-renewal.service.ts` and its spec before touching dates.
- Amounts: confirm unit (naira vs kobo) at every boundary; round with 1-kobo tolerance as in `subscription-payments.service.ts`.
- 6-month trial auto-bootstraps on first profile (personal) / org creation (CP). Don't add another bootstrap path.
- Any change to a spec'd lifecycle transition needs updated `*.spec.ts` and a line in `docs/SUBSCRIPTION_IMPLEMENTATION_STATUS.md`.
