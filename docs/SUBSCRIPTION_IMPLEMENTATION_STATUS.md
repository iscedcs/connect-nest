# Subscription Implementation Status

## ✅ Completed

### Phase 1 — Database Schema
- Added `PlanTier` enum: `FREE`, `PRO_LITE`, `PRO_PLUS`
- Added `SubscriptionStatus` enum: `TRIALING`, `ACTIVE`, `PAST_DUE`, `CANCELLED`, `EXPIRED`
- Added `Plan` model (plan catalogue)
- Added `Subscription` model (`userId String @unique` — scoped per user)
- Added `PaymentRecord` model
- Added 4 new `NotificationType` values: `SUBSCRIPTION_TRIAL_EXPIRED`, `SUBSCRIPTION_ACTIVATED`, `SUBSCRIPTION_CANCELLED`, `SUBSCRIPTION_PAST_DUE`
- Schema pushed to Neon PostgreSQL via `prisma db push`

### Phase 2 — Module Scaffolding
- Created `src/subscriptions/` module directory with all files
- Registered `SubscriptionsModule` in `AppModule`
- Registered `ScheduleModule.forRoot()` in `AppModule` for cron jobs

### Phase 3 — Plan Limits Config
- Created `src/subscriptions/plan-limits.config.ts`
- Defines `PLAN_LIMITS` for all three tiers with every feature limit
- Key limits:
  - FREE: 1 profile, 20 taps/day, 3 social links, 1 video, 2 files, 10 MB storage, 1 meeting link, 0 forms, 3 days analytics history, 0 Spotify, 0 crypto wallets, 0 service categories, no artisan directory, no module reordering
  - PRO_LITE: 2 profiles, unlimited taps, 5 social links, 5 videos, 10 files, 50 MB storage, unlimited meeting links, 1 form, 15 days analytics history, 3 Spotify, 1 crypto wallet, 3 service categories, artisan eligible, no module reordering
  - PRO_PLUS: 5 profiles, unlimited everything, 5 service categories, artisan eligible, module reordering enabled

### Phase 4 — Subscriptions Service
- Created `src/subscriptions/subscriptions.service.ts`
- Methods: `createSubscription`, `getActiveSubscription`, `getUserLimits`, `checkLimit`, `upgradePlan`, `cancelSubscription`, `handleTrialExpiry`, `downgradeToFree`, `getActivePlans`, `buildSubscriptionResponse`, `processTrialExpiries` (cron), `processPaidExpiries` (cron)
- FREE plan is auto-bootstrapped on first profile creation (no trial)
- TRIALING status flows → EXPIRED → downgrade to FREE via cron

### Phase 5 — Enforcement Infrastructure
- Created `src/subscriptions/guards/plan-limit.guard.ts` — route-level guard for boolean/zero feature flags; reads `request.isce_auth.id`
- Created `src/subscriptions/decorators/plan-feature.decorator.ts` — `@PlanFeature(feature)`
- Created `src/subscriptions/decorators/require-plan.decorator.ts` — `@RequirePlan(...tiers)`
- Created `src/subscriptions/exceptions/plan-limit.exception.ts` — extends `ForbiddenException`, returns `{ statusCode: 403, error: 'PLAN_LIMIT_EXCEEDED', message, upgradeRequired }`

### Phase 6 — Subscriptions Controller
- Created `src/subscriptions/subscriptions.controller.ts`
- Endpoints:
  - `GET  /api/subscriptions/me` — current subscription details
  - `GET  /api/subscriptions/plans` — list all plans (public)
  - `GET  /api/subscriptions/limits` — current user's plan limits
  - `POST /api/subscriptions/select-plan` — select FREE plan or initiate upgrade
  - `POST /api/subscriptions/cancel` — cancel subscription
  - `POST /api/subscriptions/initiate-payment` — **stub only** (see "Remaining" section)

### Phase 7 — Payment Gateway (Paydestal) — Stub Only
- Controller endpoint returns `{ success: false, message: 'Payment gateway integration pending' }`
- Deferred until Paydestal credentials are available

### Phase 8 — Hook Enforcement into Existing Services
All services updated to inject `SubscriptionsService`, call `getUserLimits()`, and enforce plan limits. Catch blocks include `if (error instanceof HttpException) throw error` to propagate 403s.

| Service | Feature Enforced |
|---------|-----------------|
| `profile.service.ts` | `limits.profiles` — max profiles per user; FREE auto-bootstrapped on first profile |
| `social.service.ts` | `limits.socialLinks` — counted across all profiles |
| `videos.service.ts` | `limits.videos` |
| `meetings.service.ts` | `limits.meetingLinks` |
| `files.service.ts` | `limits.files` (count) + `limits.storageBytes` (aggregate sum) |
| `forms.service.ts` | `limits.customForms` |
| `spotify.service.ts` | `limits.spotifyItems` |
| `wallets.service.ts` | `limits.cryptoWallets` |
| `artisan.service.ts` | `limits.artisanDirectoryEligible` (register) + `limits.serviceCategories` (updateCategories) |
| `connect-config.controller.ts` | `limits.moduleReordering` via `@PlanFeature` + `@UseGuards(PlanLimitGuard)` |
| `card-interactions.service.ts` | `limits.tapsPerDay` (recording) + `limits.analyticsHistoryDays` (history query) |

### Phase 9 — Seed Plan Data
- Created and ran `scripts/seed-plans.ts`
- Plans seeded in DB: FREE (₦0), Pro Lite (₦1,000), Pro Plus (₦1,500)

### Notification Support
- Added 4 emoji mappings to `src/notification/email.service.ts` for subscription notification types

### TypeScript
- `npx tsc --noEmit` passes with **0 errors**

---

## ❌ Remaining / Not Yet Implemented

### Phase 7 — Paydestal Payment Integration
**Blocked on credentials.** When `PAYDESTAL_BASE_URL`, `PAYDESTAL_SECRET_KEY`, and `PAYDESTAL_PUBLIC_KEY` are available:
- Implement `POST /api/subscriptions/initiate-payment` to create a Paydestal payment session
- Create `src/subscriptions/webhooks/payment-webhook.handler.ts` to handle Paydestal payment success/failure callbacks
- On successful payment, call `upgradePlan(userId, planKey, gatewaySubId)` to activate the subscription

### Analytics History — Additional Methods
`getInteractionsByMethod` and `getInteractionsByDevice` in `card-interactions.service.ts` do not yet apply the `analyticsHistoryDays` date filter. Only `getCardInteractions` was updated. Update the other two methods similarly if needed.

### Feature Flags — No Endpoints Yet
These limits are defined in `plan-limits.config.ts` but have no corresponding endpoints/services to enforce yet. Add `@PlanFeature` + `@UseGuards(PlanLimitGuard)` when the endpoints are built:

| Feature | Limit Key | Notes |
|---------|-----------|-------|
| Theme customisation | `themeCustomization` | No `ThemeService` exists yet |
| Contact/card export | `contactExport` | No export endpoint exists yet |
| Remove ISCE branding | `removeIsceBranding` | No branding control endpoint yet |
| Public profile search | `publiclySearchable` | No separate search service (artisan directory registration already gated via `artisanDirectoryEligible`) |
| Verified badge | `verifiedBadge` | No badge assignment flow yet |
| Priority support | `prioritySupport` | No support routing logic yet |
| Priority ranking | `priorityRanking` | No ranking/discovery service yet |

---

## Notes

- **DB workflow**: Neon PostgreSQL, `prisma db push` (no migration history). Run `npx prisma generate` after schema changes.
- **Branch**: `sub`
- **Auth pattern**: `request.isce_auth.id` is the `userId` (set by global `AuthGuard`). Guards and services must use this field, not `request.user`.
- **Subscription scoping**: `Subscription.userId` is a plain string (no FK) matching `Profile.userId`.
