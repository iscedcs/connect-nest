# Subscription Plan — Implementation Plan

**Spec source:** `src/docs/subscription-plan.md`  
**Status:** Ready to implement  
**Branch:** `sub`

---

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| `Subscription` user anchor | `userId: String @unique` (no FK) | No `User` model exists in Prisma — user identity comes from JWT via `isce-auth`. Mirrors `Artisan.userId` pattern already in the codebase. |
| Limit scope | Per-user aggregate across all profiles | Queries will join through `Profile.userId` to aggregate counts (e.g. total files across all profiles). |
| Subscription creation | Auto-create FREE on first profile creation **+** explicit `select-plan` endpoint | `ProfileService.createProfile()` will bootstrap a FREE subscription if none exists. |
| Payment gateway | Paydestal (env vars already configured) | `PAYDESTAL_BASE_URL`, `PAYDESTAL_SECRET_KEY`, `PAYDESTAL_PUBLIC_KEY` are already in env. |
| Scheduler | `@nestjs/schedule` | Already installed (`^5.0.1`) but `ScheduleModule` is **not yet** registered in `AppModule`. |

---

## Phases

### Phase 1 — Database Schema

**Files to modify:** `prisma/schema.prisma`

#### 1.1 Add Enums (append after existing enums)

```prisma
enum SubscriptionStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  CANCELLED
  EXPIRED
}

enum PlanTier {
  FREE
  PRO_LITE
  PRO_PLUS
}
```

#### 1.2 Add `Plan` Model

```prisma
model Plan {
  id            String         @id @default(uuid())
  key           PlanTier       @unique
  name          String
  priceMonthly  Int            // in kobo; 0 for FREE
  isActive      Boolean        @default(true)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  subscriptions Subscription[]
}
```

#### 1.3 Add `Subscription` Model

> **Note:** No FK on `userId` — stored as a plain string (same as `Artisan.userId`). `@unique` enforces one subscription per user account.

```prisma
model Subscription {
  id                 String             @id @default(uuid())
  userId             String             @unique  // userId from JWT, no FK
  planId             String
  status             SubscriptionStatus @default(TRIALING)
  trialStartDate     DateTime?
  trialEndDate       DateTime?
  trialUsed          Boolean            @default(false)
  currentPeriodStart DateTime?
  currentPeriodEnd   DateTime?
  cancelledAt        DateTime?
  gatewayCustomerId  String?
  gatewaySubId       String?
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt

  plan           Plan            @relation(fields: [planId], references: [id])
  paymentHistory PaymentRecord[]
}
```

#### 1.4 Add `PaymentRecord` Model

```prisma
model PaymentRecord {
  id             String       @id @default(uuid())
  subscriptionId String
  amount         Int          // in kobo
  currency       String       @default("NGN")
  status         String       // 'success' | 'failed' | 'pending'
  gatewayRef     String?
  paidAt         DateTime?
  createdAt      DateTime     @default(now())

  subscription Subscription @relation(fields: [subscriptionId], references: [id])
}
```

#### 1.5 Migration Commands

```bash
# 1. Generate migration (review SQL before applying — confirm no drops on Profile)
npx prisma migrate dev --name add_subscription_tiers --create-only

# 2. Review /prisma/migrations/<timestamp>_add_subscription_tiers/migration.sql

# 3. Apply
npx prisma migrate dev

# 4. Regenerate client
npx prisma generate
```

---

### Phase 2 — Module Scaffolding

Create the following file structure under `src/subscriptions/`:

```
src/subscriptions/
├── subscriptions.module.ts
├── subscriptions.service.ts
├── subscriptions.controller.ts
├── plan-limits.config.ts
├── dto/
│   ├── create-subscription.dto.ts   // { planKey: PlanTier }
│   └── upgrade-plan.dto.ts          // { planKey: PlanTier }
├── guards/
│   └── plan-limit.guard.ts
├── decorators/
│   ├── plan-feature.decorator.ts
│   └── require-plan.decorator.ts
├── exceptions/
│   └── plan-limit.exception.ts
└── webhooks/
    └── payment-webhook.handler.ts
```

#### 2.1 Register in `AppModule` (`src/app.module.ts`)

Add two imports:

```typescript
import { ScheduleModule } from '@nestjs/schedule';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';

// Inside @Module({ imports: [...] })
ScheduleModule.forRoot(),
SubscriptionsModule,
```

---

### Trial Logic (Cross-cutting concern — applies to Phases 1, 4, and 8)

The 3-month free trial is one of the most important behaviours in the system. Every part of the implementation must respect these rules.

#### Rules

| Rule | Detail |
|---|---|
| **Who gets a trial** | Only users who select `PRO_LITE` or `PRO_PLUS` at onboarding. Choosing `FREE` starts permanently on FREE — no trial concept. |
| **Duration** | Exactly 3 calendar months from `trialStartDate` (e.g. select on May 15 → `trialEndDate` = Aug 15) |
| **Trial access** | During trial, the user gets **full access** to all features of their chosen paid plan at zero cost |
| **One trial per lifetime** | `trialUsed = true` is set on creation and never reset. Even if the user switches plans or cancels, they cannot start a new trial |
| **Expiry — happy path** | If a valid payment method (`gatewayCustomerId`) is on file → auto-charge and transition to `ACTIVE` |
| **Expiry — no payment method** | Downgrade to `FREE` plan, set `status = EXPIRED`, notify user via `NotificationDispatcher` |
| **`TRIALING` user limits** | `getUserLimits()` must return the **trialed plan's limits** (e.g. PRO_PLUS limits), not FREE limits |

#### Schema fields involved

```prisma
trialStartDate  DateTime?   // Set to now() on createSubscription for paid plans
trialEndDate    DateTime?   // Set to addMonths(now(), 3)
trialUsed       Boolean     // Set to true on createSubscription; never reset
status          SubscriptionStatus  // TRIALING → ACTIVE or EXPIRED at trial end
```

#### `createSubscription` logic (full decision tree)

```
if planKey === 'FREE':
  status = ACTIVE
  trialStartDate = null
  trialEndDate = null
  trialUsed = false  ← FREE users never consume trial eligibility

if planKey === 'PRO_LITE' | 'PRO_PLUS':
  status = TRIALING
  trialStartDate = now()
  trialEndDate = addMonths(now(), 3)
  trialUsed = true
```

Use `date-fns` or native `Date` arithmetic (`new Date(now.setMonth(now.getMonth() + 3))`) — no extra library required.

#### `handleTrialExpiry` logic (full decision tree)

```
1. Load subscription with plan + userId
2. if gatewayCustomerId exists:
     a. Call Paydestal charge API with amount = plan.priceMonthly
     b. if charge succeeds:
          - status = ACTIVE
          - currentPeriodStart = now()
          - currentPeriodEnd = addMonths(now(), 1)
          - create PaymentRecord { status: 'success', ... }
          - notify user: plan is now paid
     c. if charge fails:
          - create PaymentRecord { status: 'failed', ... }
          - fall through to step 3
3. if no gatewayCustomerId OR charge failed:
     - find FREE plan record from DB
     - subscription.planId = freePlan.id
     - status = EXPIRED
     - notify user: trial ended, downgraded to FREE
```

#### All paths that lead to FREE downgrade

Every route that ends with the user on the FREE plan goes through the shared `downgradeToFree(subscriptionId)` helper:

```
Trial expires, no payment method  →  downgradeToFree()  →  status = EXPIRED, planId = FREE
Trial expires, charge fails       →  downgradeToFree()  →  status = EXPIRED, planId = FREE
Paid plan cancelled + period ends →  downgradeToFree()  →  status = EXPIRED, planId = FREE
Paid plan PAST_DUE + period ends  →  downgradeToFree()  →  status = EXPIRED, planId = FREE
```

In all cases `getUserLimits()` will return `PLAN_LIMITS.FREE` for any status that is not `TRIALING` or `ACTIVE`.

#### `getUserLimits` trial-awareness rule

```typescript
// TRIALING users get full paid-plan limits — trial = full access
if (status === 'TRIALING' || status === 'ACTIVE') {
  return PLAN_LIMITS[sub.plan.key];   // e.g. PLAN_LIMITS.PRO_PLUS
}
// Everything else (EXPIRED, CANCELLED, PAST_DUE) → FREE limits immediately
return PLAN_LIMITS.FREE;
```

#### Cron jobs — daily expiry checks (two separate jobs, same midnight schedule)

```typescript
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async processTrialExpiries(): Promise<void> {
  const expired = await this.databaseService.subscription.findMany({
    where: { status: 'TRIALING', trialEndDate: { lte: new Date() } },
  });
  for (const sub of expired) await this.handleTrialExpiry(sub.id);
}

@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async processPaidExpiries(): Promise<void> {
  // Cancelled subs whose access period has now ended
  // PAST_DUE subs whose period has ended without recovery
  const expired = await this.databaseService.subscription.findMany({
    where: {
      status: { in: ['CANCELLED', 'PAST_DUE'] },
      currentPeriodEnd: { lte: new Date() },
    },
  });
  for (const sub of expired) await this.downgradeToFree(sub.id);
}
```

`ScheduleModule.forRoot()` must be registered in `AppModule` (Phase 2) for `@Cron` to activate.

#### `GET /subscriptions/me` response — trial fields

```json
{
  "plan": { "key": "PRO_LITE", "name": "Pro Lite", "priceMonthly": 1000 },
  "status": "TRIALING",
  "isInTrial": true,
  "trialEndDate": "2026-08-15T00:00:00.000Z",
  "daysRemaining": 92,
  "currentPeriodEnd": null
}
```

`isInTrial` and `daysRemaining` are **computed at query time** in the service — not stored in DB.

---

### Phase 3 — Plan Limits Config

**File:** `src/subscriptions/plan-limits.config.ts`

Implement exactly as specified in `src/docs/subscription-plan.md` Section 2.  
`Infinity` is used for unlimited — all numeric enforcement checks use `currentCount >= limit` (passes when `limit === Infinity`).

**Export:**
- `PLAN_LIMITS` constant
- `PlanKey` type (`'FREE' | 'PRO_LITE' | 'PRO_PLUS'`)
- `PlanLimits` type (union of all limit objects)

---

### Phase 4 — Subscriptions Service

**File:** `src/subscriptions/subscriptions.service.ts`

Inject `DatabaseService` (existing `PrismaService` wrapper).

#### 4.1 Method signatures to implement

| Method | Trigger | Notes |
|---|---|---|
| `createSubscription(userId, planKey)` | First profile creation (auto FREE) or explicit `select-plan` call | If `planKey === 'FREE'`, set `status = ACTIVE`, no trial dates. Otherwise `status = TRIALING`, `trialUsed = true`, `trialEndDate = now + 3 months`. Throw `ConflictException` if subscription already exists (for explicit call; skip check in auto-create path). |
| `getActiveSubscription(userId)` | Any subscription read | Include `plan`. Throw `NotFoundException` if none. |
| `getUserLimits(userId)` | Every enforcement check | If `status === EXPIRED` or `CANCELLED` → return `PLAN_LIMITS.FREE`. If `status === TRIALING` or `ACTIVE` → return limits for `plan.key`. |
| `checkLimit(userId, feature, currentCount)` | Numeric resource checks | Returns `true` if within limit. Handles `Infinity`. |
| `upgradePlan(userId, newPlanKey, gatewaySubId)` | `charge.success` webhook | Updates `planId`, `status = ACTIVE`, `gatewaySubId`. Does not reset `trialUsed`. |
| `cancelSubscription(userId)` | `POST /subscriptions/cancel` | Sets `status = CANCELLED`, `cancelledAt = now()`. Access continues until `currentPeriodEnd`. The daily cron job then detects expired `CANCELLED` subs and calls `downgradeToFree()`. |
| `handleTrialExpiry(subscriptionId)` | Called by cron job | If `gatewayCustomerId` exists → attempt charge via Paydestal → on success set `ACTIVE`; on fail → call `downgradeToFree()`. |
| `downgradeToFree(subscriptionId)` | Called by trial expiry, payment failure, and cancelled period end | Shared helper: find FREE plan from DB, set `planId = freePlan.id`, `status = EXPIRED`, notify user via `NotificationDispatcher`. |
| `processPaidExpiries()` | `@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)` | Runs alongside `processTrialExpiries()`. Queries `CANCELLED` subs where `currentPeriodEnd <= now()`, and `PAST_DUE` subs where `currentPeriodEnd <= now()`. Calls `downgradeToFree()` for each. |
| `processTrialExpiries()` | `@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)` | Query all `TRIALING` subscriptions where `trialEndDate <= now()`. Call `handleTrialExpiry` for each. |

> **Per-user aggregate pattern:** When counting resources for limit checks, always query:
> ```typescript
> this.databaseService.social.count({
>   where: { user: { userId: userId }, deletedAt: null }
> })
> ```
> This joins through `Profile.userId` to aggregate across all of the user's profiles.

---

### Phase 5 — Plan Enforcement Infrastructure

#### 5.1 `PlanLimitException` (`src/subscriptions/exceptions/plan-limit.exception.ts`)

Extends `ForbiddenException`. Shape:
```json
{
  "statusCode": 403,
  "error": "PLAN_LIMIT_EXCEEDED",
  "message": "Your plan does not support this action: <feature>",
  "upgradeRequired": "PRO_LITE"
}
```

#### 5.2 `PlanFeature` Decorator (`src/subscriptions/decorators/plan-feature.decorator.ts`)

```typescript
export const PlanFeature = (feature: keyof PlanLimits) =>
  SetMetadata('planFeature', feature);
```

#### 5.3 `PlanLimitGuard` (`src/subscriptions/guards/plan-limit.guard.ts`)

- Inject `SubscriptionsService` and `Reflector`
- Read `planFeature` metadata from route handler
- If no metadata → `return true` (no restriction)
- Extract `userId` from `request.user.id`
- Call `getUserLimits(userId)` and check the boolean/zero feature flags only
- For `false` or `0` → throw `PlanLimitException`
- Numeric limits (files, videos, etc.) are enforced **in the service**, not here

#### 5.4 `RequirePlan` Decorator (`src/subscriptions/decorators/require-plan.decorator.ts`)

```typescript
export const RequirePlan = (...plans: PlanTier[]) =>
  SetMetadata('requiredPlans', plans);
```

---

### Phase 6 — Subscriptions Controller

**File:** `src/subscriptions/subscriptions.controller.ts`

All routes under `/subscriptions` with `@ApiTags('Subscriptions')`.

| Method | Route | Auth | Guard | Description |
|---|---|---|---|---|
| `GET` | `/subscriptions/me` | JWT | — | Returns subscription + plan + `isInTrial` + `daysRemaining` |
| `GET` | `/subscriptions/plans` | `@PublicRoute()` | — | Returns all active plans from DB |
| `GET` | `/subscriptions/limits` | JWT | — | Returns effective `PlanLimits` for current user |
| `POST` | `/subscriptions/select-plan` | JWT | — | `{ planKey }` — starts trial (or sets FREE permanently) |
| `POST` | `/subscriptions/initiate-payment` | JWT | — | Creates Paydestal checkout session, returns payment URL |
| `POST` | `/subscriptions/cancel` | JWT | — | Cancels paid subscription |
| `POST` | `/webhooks/payment` | `@PublicRoute()` | Signature validation | Receives Paydestal webhook events |

> **Webhook route** must be decorated with `@PublicRoute()` (from `src/auth/decorators/public-route.decorator.ts`) to bypass the global `AuthGuard`.

---

### Phase 7 — Paydestal Payment Integration

**File:** `src/subscriptions/webhooks/payment-webhook.handler.ts`

#### 7.1 Initiating Payment (`POST /subscriptions/initiate-payment`)

1. Receive `{ planKey }` from frontend
2. Look up the `Plan` record from DB by `planKey`
3. Call Paydestal API to create a payment/subscription session
4. Return `{ checkoutUrl, reference }` to frontend

Use `PAYDESTAL_BASE_URL`, `PAYDESTAL_SECRET_KEY`, `PAYDESTAL_PUBLIC_KEY` from `process.env`.  
Follow the same HTTP client pattern as `WalletClientService` (axios-based).

#### 7.2 Webhook Handler

Validate `x-paydestal-signature` (or equivalent header) before processing.

Events to handle:

| Event | Action |
|---|---|
| `charge.success` | Call `upgradePlan(userId, planKey, gatewaySubId)`, create `PaymentRecord` |
| `subscription.disable` | Set `status = PAST_DUE`, notify user |
| `invoice.payment_failed` | Increment retry tracking; after max retries → set `status = PAST_DUE`. The daily `processPaidExpiries()` cron will then call `downgradeToFree()` once `currentPeriodEnd` passes. |

Webhook endpoint must return HTTP `200` immediately regardless of processing outcome (standard webhook contract).

---

### Phase 8 — Enforce Limits in Existing Services

Below is the complete list of modifications to existing service files.

> **Pattern for all numeric checks:**
> ```typescript
> const limits = await this.subscriptionsService.getUserLimits(userId);
> const currentCount = await this.databaseService.<model>.count({
>   where: { user: { userId }, deletedAt: null }  // aggregate across all profiles
> });
> if (currentCount >= limits.<feature>) {
>   throw new PlanLimitException('<feature>', <upgradeRequiredTier>);
> }
> ```
> Inject `SubscriptionsService` into each affected service via constructor.

| File | Method | Limit Field | Notes |
|---|---|---|---|
| `src/profile/profile.service.ts` | `createProfile()` | `profiles` | Also auto-create FREE subscription here if none exists: call `subscriptionsService.createSubscription(userId, 'FREE')` only if no subscription found. Count non-deleted profiles for user. |
| `src/social/social.service.ts` | `createSocial()` | `socialLinks` | Count all non-deleted socials across all user profiles |
| `src/videos/videos.service.ts` | upload/create method | `videos` | Count all non-deleted videos across all user profiles |
| `src/files/files.service.ts` | upload method | `files` + `storageBytes` | Also sum `size_bytes` from all `FileItem` records for user, compare against `limits.storageBytes` |
| `src/meetings/meetings.service.ts` | create method | `meetingLinks` | Count all non-deleted meeting links across all user profiles |
| `src/forms/forms.service.ts` | `createForm()` | `customForms` | Count non-deleted forms across all user profiles |
| `src/spotify/spotify.service.ts` | add method | `spotifyItems` | Count non-deleted Spotify items across all user profiles |
| `src/wallets/wallets.service.ts` | `createWallet()` | `cryptoWallets` | Count non-deleted wallets across all user profiles |
| `src/artisan/artisan.service.ts` | `addCategory()` | `serviceCategories` | Count categories for user's artisan record |

#### 8.1 Boolean Feature Flag Enforcement (Route Guards)

Apply `@UseGuards(AuthGuard, PlanLimitGuard)` + `@PlanFeature(...)` to these routes:

| Route | Feature Flag | Controller File |
|---|---|---|
| `GET /contacts/export` | `contactExport` | `src/contact/contact.controller.ts` |
| `PATCH /connect-config/reorder` | `moduleReordering` | `src/connect-config/connect-config.controller.ts` |
| `PATCH /connect-config/branding` | `removeIsceBranding` | `src/connect-config/connect-config.controller.ts` |

---

### Phase 9 — Plan Seeding

**File:** `prisma/seed.ts` (create if not present, or append to existing seed script)

```typescript
import { PLAN_LIMITS } from '../src/subscriptions/plan-limits.config';

async function seedPlans(prisma: PrismaClient) {
  const plans = [
    { key: 'FREE',     name: PLAN_LIMITS.FREE.name,     priceMonthly: 0      },
    { key: 'PRO_LITE', name: PLAN_LIMITS.PRO_LITE.name, priceMonthly: 100000 }, // ₦1,000 in kobo
    { key: 'PRO_PLUS', name: PLAN_LIMITS.PRO_PLUS.name, priceMonthly: 150000 }, // ₦1,500 in kobo
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { key: plan.key as PlanTier },
      update: { name: plan.name, priceMonthly: plan.priceMonthly },
      create: plan,
    });
  }
}
```

Ensure `package.json` has a `prisma.seed` entry pointing to the seed file.

---

## Implementation Order

| # | Task | Depends on |
|---|---|---|
| 1 | Add enums + models to `schema.prisma` | — |
| 2 | Run migration + `prisma generate` | 1 |
| 3 | Create `plan-limits.config.ts` | — |
| 4 | Scaffold `src/subscriptions/` module files | 2, 3 |
| 5 | Implement `SubscriptionsService` core methods | 4 |
| 6 | Add `ScheduleModule.forRoot()` + `SubscriptionsModule` to `AppModule` | 4 |
| 7 | Implement enforcement infrastructure (exception, decorator, guard) | 5 |
| 8 | Implement `SubscriptionsController` endpoints | 5, 7 |
| 9 | Integrate enforcement into existing services (Phase 8) | 5, 7 |
| 10 | Implement Paydestal payment initiation + webhook handler | 5, 8 |
| 11 | Seed plan data | 2, 3 |
| 12 | Add boolean-flag guards to existing controllers | 7 |

---

## Open Items Before Implementation

| # | Item | Status |
|---|---|---|
| 1 | Confirm the Paydestal subscription/recurring charge API endpoint and payload shape | **Needs research** |
| 2 | Confirm Paydestal webhook signature header name and algorithm | **Needs research** |
| 3 | Confirm whether `CardInteraction` (taps) enforcement is needed — currently excluded from plan | **Deferred (out of scope for now)** |
| 4 | Confirm `analyticsHistoryDays` enforcement — no analytics query service exists yet | **Deferred** |
| 5 | `artisanDirectoryEligible` and `publiclySearchable` enforcement — confirm which query/filter these should gate | **Clarify with product** |
