# ISCE Connect — Subscription Plan Implementation Spec
**Project:** ISCE Connect Backend  
**Stack:** NestJS · TypeScript · Prisma · PostgreSQL  
**Scope:** Introduce product-level subscription tiers (FREE, PRO LITE, PRO PLUS) with enforcement, trial logic, and payment gateway integration  
**Enforcement Layer:** Backend only  
**Document Type:** Engineering Change Spec  
**Status:** Ready for Implementation

---

## Table of Contents
1. [Overview](#1-overview)
2. [Plan Definitions & Limits](#2-plan-definitions--limits)
3. [Trial Policy](#3-trial-policy)
4. [Database Schema Changes](#4-database-schema-changes)
5. [Prisma Migration Notes](#5-prisma-migration-notes)
6. [Module Structure](#6-module-structure)
7. [Subscription Service Logic](#7-subscription-service-logic)
8. [Plan Enforcement Strategy](#8-plan-enforcement-strategy)
9. [Payment Gateway Integration](#9-payment-gateway-integration)
10. [API Endpoints](#10-api-endpoints)
11. [Error Handling & Responses](#11-error-handling--responses)
12. [Seeding Plan Data](#12-seeding-plan-data)
13. [Open Questions & Assumptions](#13-open-questions--assumptions)

---

## 1. Overview

This document specifies all backend changes required to introduce tiered subscription logic into the existing ISCE Connect codebase. No subscription infrastructure currently exists. Every section below describes a **net-new addition** or **modification** to existing files.

### Goals
- Define three subscription tiers with enforced per-feature limits
- Grant every new user a **3-month free trial** on the plan they select at signup (or default to FREE if none selected)
- Integrate with the existing payment gateway to activate paid plans after trial expiry
- Enforce limits at the backend service layer using a reusable guard/decorator pattern

### Out of Scope
- Frontend UI for plan selection or upgrade prompts
- Email notification system (referenced only as integration point)
- Admin dashboard for manual plan overrides (noted as future work)

---

## 2. Plan Definitions & Limits

Define plan constants in a central config file: `src/subscriptions/plan-limits.config.ts`

```typescript
export const PLAN_LIMITS = {
  FREE: {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    profiles: 1,
    tapsPerDay: 20,
    socialLinks: 3,
    videos: 1,
    files: 2,
    storageBytes: 10 * 1024 * 1024,        // 10MB
    meetingLinks: 1,
    customForms: 0,
    analyticsHistoryDays: 3,
    contactExport: false,
    removeIsceBranding: false,
    themeCustomization: 'none',            // 'none' | 'basic' | 'full'
    moduleReordering: false,
    spotifyItems: 0,
    cryptoWallets: 0,
    serviceCategories: 0,
    artisanDirectoryEligible: false,
    publiclySearchable: false,
    verifiedBadge: false,
    prioritySupport: false,
    priorityRanking: false,
  },

  PRO_LITE: {
    id: 'pro_lite',
    name: 'Pro Lite',
    priceMonthly: 1000,
    profiles: 2,
    tapsPerDay: Infinity,
    socialLinks: 5,
    videos: 5,
    files: 10,
    storageBytes: 50 * 1024 * 1024,        // 50MB
    meetingLinks: Infinity,
    customForms: 1,
    analyticsHistoryDays: 15,
    contactExport: true,
    removeIsceBranding: true,
    themeCustomization: 'basic',
    moduleReordering: false,
    spotifyItems: 3,
    cryptoWallets: 1,
    serviceCategories: 3,
    artisanDirectoryEligible: true,
    publiclySearchable: true,
    verifiedBadge: false,
    prioritySupport: false,
    priorityRanking: false,
  },

  PRO_PLUS: {
    id: 'pro_plus',
    name: 'Pro Plus',
    priceMonthly: 1500,
    profiles: 5,
    tapsPerDay: Infinity,
    socialLinks: Infinity,
    videos: Infinity,
    files: Infinity,
    storageBytes: Infinity,
    meetingLinks: Infinity,
    customForms: Infinity,
    analyticsHistoryDays: Infinity,
    contactExport: true,
    removeIsceBranding: true,
    themeCustomization: 'full',
    moduleReordering: true,
    spotifyItems: Infinity,
    cryptoWallets: Infinity,
    serviceCategories: 5,
    artisanDirectoryEligible: true,
    publiclySearchable: true,
    verifiedBadge: true,
    prioritySupport: true,
    priorityRanking: true,
  },
} as const;

export type PlanKey = keyof typeof PLAN_LIMITS;
export type PlanLimits = (typeof PLAN_LIMITS)[PlanKey];
```

> **Convention:** Use `Infinity` for unlimited. All enforcement checks should use `value < limit` — `Infinity` will always pass.

---

## 3. Trial Policy

- **Duration:** 3 calendar months from the date of plan selection or account creation
- **Applicable Plans:** PRO LITE and PRO PLUS only. FREE plan has no trial concept — it is permanent by default
- **Behaviour during trial:** User gets full access to all features of their chosen paid plan at no charge
- **On trial expiry:**
  - If a valid payment method and active subscription exist → auto-transition to paid status
  - If no payment method on file → downgrade to FREE plan automatically; notify user (via existing notification system)
- **Trial re-eligibility:** A user is entitled to **one trial per plan tier, per lifetime account**. Switching plans resets nothing; the trial clock is per-account, not per-plan

### Trial Fields on Subscription Record
| Field | Type | Purpose |
|---|---|---|
| `trialStartDate` | `DateTime` | Set at plan selection |
| `trialEndDate` | `DateTime` | `trialStartDate + 3 months` |
| `isInTrial` | Computed | `now() < trialEndDate && status = TRIALING` |
| `trialUsed` | `Boolean` | Prevents re-trial abuse |

---

## 4. Database Schema Changes

### 4.1 New Enum: `SubscriptionStatus`

```prisma
enum SubscriptionStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  CANCELLED
  EXPIRED
}
```

### 4.2 New Enum: `PlanTier`

```prisma
enum PlanTier {
  FREE
  PRO_LITE
  PRO_PLUS
}
```

### 4.3 New Model: `Plan`

Stores canonical plan metadata. Seeded — not user-editable.

```prisma
model Plan {
  id             String         @id @default(uuid())
  key            PlanTier       @unique
  name           String
  priceMonthly   Int            // in kobo (smallest unit); 0 for FREE
  isActive       Boolean        @default(true)
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
  subscriptions  Subscription[]
}
```

### 4.4 New Model: `Subscription`

One active subscription per user at any time.

```prisma
model Subscription {
  id                String             @id @default(uuid())
  userId            String             @unique
  planId            String
  status            SubscriptionStatus @default(TRIALING)
  trialStartDate    DateTime?
  trialEndDate      DateTime?
  trialUsed         Boolean            @default(false)
  currentPeriodStart DateTime?
  currentPeriodEnd   DateTime?
  cancelledAt       DateTime?
  gatewayCustomerId  String?           // ID from payment gateway
  gatewaySubId       String?           // Subscription ID from payment gateway
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt

  user              User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  plan              Plan               @relation(fields: [planId], references: [id])
  paymentHistory    PaymentRecord[]
}
```

### 4.5 New Model: `PaymentRecord`

Audit trail for all payment events.

```prisma
model PaymentRecord {
  id              String       @id @default(uuid())
  subscriptionId  String
  amount          Int          // in kobo
  currency        String       @default("NGN")
  status          String       // 'success' | 'failed' | 'pending'
  gatewayRef      String?      // reference from payment gateway
  paidAt          DateTime?
  createdAt       DateTime     @default(now())

  subscription    Subscription @relation(fields: [subscriptionId], references: [id])
}
```

### 4.6 Changes to Existing `User` Model

Add the following relation fields (do **not** remove existing fields):

```prisma
// Add inside existing User model
subscription  Subscription?
```

---

## 5. Prisma Migration Notes

Run in order:

```bash
# 1. Generate migration (do not run yet — review SQL first)
npx prisma migrate dev --name add_subscription_tiers --create-only

# 2. Review generated SQL in /prisma/migrations/
# Confirm no accidental column drops on User table

# 3. Apply migration
npx prisma migrate dev

# 4. Regenerate client
npx prisma generate

# 5. Run seed (see Section 12)
npx prisma db seed
```

> ⚠️ **Important:** If the `User` model has existing relations that reference columns being added, check for conflicts before applying. The `subscription Subscription?` relation is optional and non-breaking.

---

## 6. Module Structure

Create a new NestJS module at `src/subscriptions/`:

```
src/subscriptions/
├── subscriptions.module.ts
├── subscriptions.service.ts
├── subscriptions.controller.ts
├── plan-limits.config.ts
├── dto/
│   ├── create-subscription.dto.ts
│   └── upgrade-plan.dto.ts
├── guards/
│   └── plan-limit.guard.ts
├── decorators/
│   ├── plan-feature.decorator.ts
│   └── require-plan.decorator.ts
├── interfaces/
│   └── subscription.interface.ts
└── webhooks/
    └── payment-webhook.handler.ts
```

Register in `AppModule`:

```typescript
// app.module.ts
import { SubscriptionsModule } from './subscriptions/subscriptions.module';

@Module({
  imports: [
    // ... existing imports
    SubscriptionsModule,
  ],
})
export class AppModule {}
```

---

## 7. Subscription Service Logic

### 7.1 Core Methods — `SubscriptionsService`

```typescript
// Key method signatures (implement in subscriptions.service.ts)

createSubscription(userId: string, planKey: PlanKey): Promise<Subscription>
// Called at user registration or plan selection
// Sets status = TRIALING if planKey != FREE
// Sets trialStartDate = now(), trialEndDate = now() + 3 months
// Sets trialUsed = true

getActiveSubscription(userId: string): Promise<Subscription & { plan: Plan }>
// Returns current subscription with plan joined
// Throws NotFoundException if none exists

getUserLimits(userId: string): Promise<PlanLimits>
// Resolves the effective limit object for a user
// Respects trial: if TRIALING, return limits for the plan being trialed
// If EXPIRED/CANCELLED with no active sub, return FREE limits

checkLimit(userId: string, feature: keyof PlanLimits, currentCount: number): Promise<boolean>
// Returns true if user is within limit, false if exceeded
// Handles Infinity correctly

upgradePlan(userId: string, newPlanKey: PlanKey, gatewaySubId: string): Promise<Subscription>
// Transitions subscription to new plan
// Updates status to ACTIVE
// Does not restart trial if trialUsed = true

cancelSubscription(userId: string): Promise<Subscription>
// Sets status = CANCELLED, cancelledAt = now()
// Schedules downgrade to FREE at end of current period

handleTrialExpiry(subscriptionId: string): Promise<void>
// Called by a scheduled job
// If payment method exists → charge and set ACTIVE
// If not → downgrade to FREE, set status = EXPIRED
```

### 7.2 Scheduled Job — Trial Expiry Check

Use `@nestjs/schedule`:

```typescript
// In subscriptions.service.ts
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async processTrialExpiries(): Promise<void> {
  const expiredTrials = await this.prisma.subscription.findMany({
    where: {
      status: 'TRIALING',
      trialEndDate: { lte: new Date() },
    },
    include: { plan: true, user: true },
  });

  for (const sub of expiredTrials) {
    await this.handleTrialExpiry(sub.id);
  }
}
```

Install scheduler if not already present:
```bash
npm install @nestjs/schedule
```

---

## 8. Plan Enforcement Strategy

### 8.1 The Guard

`PlanLimitGuard` is a reusable NestJS guard applied at the route level. It reads metadata set by a custom decorator to know which feature and limit to check.

```typescript
// guards/plan-limit.guard.ts

@Injectable()
export class PlanLimitGuard implements CanActivate {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.get<keyof PlanLimits>(
      'planFeature',
      context.getHandler(),
    );
    if (!feature) return true; // No limit declared — allow

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    if (!userId) throw new UnauthorizedException();

    const limits = await this.subscriptionsService.getUserLimits(userId);
    const limit = limits[feature];

    if (limit === false || limit === 0) {
      throw new ForbiddenException(
        `Your current plan does not include access to this feature. Upgrade to unlock it.`,
      );
    }

    // For numeric limits, the calling service is responsible for count checks
    // Guard only checks boolean feature flags here
    return true;
  }
}
```

### 8.2 The Decorator

```typescript
// decorators/plan-feature.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { PlanLimits } from '../plan-limits.config';

export const PlanFeature = (feature: keyof PlanLimits) =>
  SetMetadata('planFeature', feature);
```

### 8.3 Usage on Routes

```typescript
// Example: protecting contact export endpoint
@Get('contacts/export')
@UseGuards(AuthGuard, PlanLimitGuard)
@PlanFeature('contactExport')
async exportContacts(@Req() req) {
  return this.contactsService.exportCsv(req.user.id);
}
```

### 8.4 Numeric Limit Enforcement

For countable resources (files, videos, profiles, etc.), enforce inside the **service method** — not the guard:

```typescript
// Example: inside FilesService.uploadFile()
async uploadFile(userId: string, file: Express.Multer.File): Promise<FileRecord> {
  const limits = await this.subscriptionsService.getUserLimits(userId);
  const currentCount = await this.prisma.file.count({ where: { userId } });

  if (currentCount >= limits.files) {
    throw new ForbiddenException(
      `You have reached the file limit for your plan (${limits.files} files). Upgrade to add more.`,
    );
  }

  // Also check storage
  const usedStorage = await this.getTotalStorageUsed(userId);
  if (usedStorage + file.size > limits.storageBytes) {
    throw new ForbiddenException(
      `Uploading this file would exceed your storage limit. Upgrade your plan for more storage.`,
    );
  }

  // ... proceed with upload
}
```

### 8.5 Features Requiring Enforcement (Full List)

Apply enforcement to the following existing service methods:

| Feature | Limit Field | Enforcement Location |
|---|---|---|
| Create profile | `profiles` | `ProfilesService.create()` |
| Tap tracking | `tapsPerDay` | `TapsService.recordTap()` |
| Add social link | `socialLinks` | `LinksService.addSocialLink()` |
| Upload video | `videos` | `VideosService.upload()` |
| Upload file | `files` + `storageBytes` | `FilesService.upload()` |
| Add meeting link | `meetingLinks` | `MeetingService.create()` |
| Create form | `customForms` | `FormsService.create()` |
| Export contacts | `contactExport` | Route guard |
| Apply theme | `themeCustomization` | `ThemeService.apply()` |
| Reorder modules | `moduleReordering` | Route guard |
| Add Spotify item | `spotifyItems` | `SpotifyService.add()` |
| Add crypto wallet | `cryptoWallets` | `WalletsService.add()` |
| Add service category | `serviceCategories` | `ArtisanService.addCategory()` |
| Analytics date filter | `analyticsHistoryDays` | `AnalyticsService.query()` |
| Remove ISCE branding | `removeIsceBranding` | Route guard |
| Directory listing | `artisanDirectoryEligible` | `DirectoryService.list()` |
| Public search | `publiclySearchable` | `SearchService.query()` |

---

## 9. Payment Gateway Integration

> The existing payment gateway client is assumed to already be initialised in the project. Replace `PaymentGatewayService` references below with the actual service name in the codebase.

### 9.1 Webhook Handler

Create `src/subscriptions/webhooks/payment-webhook.handler.ts` to receive and process events from the gateway:

```typescript
// Relevant webhook events to handle:

'charge.success'         → Mark subscription ACTIVE, create PaymentRecord
'subscription.disable'   → Set status = PAST_DUE, notify user
'subscription.expiry_cards' → Notify user to update card
'invoice.payment_failed' → Increment retry count; after max retries → EXPIRED → downgrade to FREE
```

### 9.2 Webhook Controller Route

```typescript
@Post('webhooks/payment')
@HttpCode(200)
async handlePaymentWebhook(
  @Headers('x-gateway-signature') signature: string,
  @Body() body: Record<string, any>,
) {
  // Validate signature using gateway secret before processing
  const isValid = this.paymentGatewayService.verifyWebhookSignature(signature, body);
  if (!isValid) throw new UnauthorizedException('Invalid webhook signature');

  return this.paymentWebhookHandler.process(body);
}
```

> ⚠️ Webhook endpoint must be **excluded** from any global auth guards. Add it to the public routes list.

### 9.3 Activating a Paid Plan

When a user initiates payment from the frontend:

1. Frontend calls `POST /subscriptions/initiate-payment` with `{ planKey: 'PRO_LITE' }`
2. Backend creates a payment session via gateway, returns a checkout URL
3. User completes payment on gateway-hosted page
4. Gateway fires `charge.success` webhook
5. Backend webhook handler calls `upgradePlan(userId, planKey, gatewaySubId)`
6. Subscription record updated to `ACTIVE`

---

## 10. API Endpoints

All routes prefixed with `/subscriptions`. All require authentication unless noted.

| Method | Route | Description |
|---|---|---|
| `GET` | `/subscriptions/me` | Get current user's subscription and plan details |
| `GET` | `/subscriptions/plans` | List all available plans (public, no auth required) |
| `GET` | `/subscriptions/limits` | Get the effective limits for the current user |
| `POST` | `/subscriptions/select-plan` | Select a plan at onboarding (starts trial) |
| `POST` | `/subscriptions/initiate-payment` | Begin payment flow for upgrade |
| `POST` | `/subscriptions/cancel` | Cancel current paid subscription |
| `POST` | `/webhooks/payment` | Receive events from payment gateway **(public)** |

### Response Shape — `GET /subscriptions/me`

```json
{
  "plan": {
    "key": "PRO_LITE",
    "name": "Pro Lite",
    "priceMonthly": 1000
  },
  "status": "TRIALING",
  "isInTrial": true,
  "trialEndDate": "2026-08-15T00:00:00.000Z",
  "daysRemaining": 91,
  "currentPeriodEnd": null
}
```

---

## 11. Error Handling & Responses

All plan enforcement errors should return consistent shapes. Create a `PlanLimitException` that extends `ForbiddenException`:

```typescript
// src/subscriptions/exceptions/plan-limit.exception.ts

export class PlanLimitException extends ForbiddenException {
  constructor(feature: string, upgradeRequired: PlanTier) {
    super({
      statusCode: 403,
      error: 'PLAN_LIMIT_EXCEEDED',
      message: `Your plan does not support this action: ${feature}`,
      upgradeRequired,      // e.g. 'PRO_LITE' — tells frontend what to prompt
    });
  }
}
```

---

## 12. Seeding Plan Data

Add to `prisma/seed.ts`:

```typescript
import { PLAN_LIMITS } from '../src/subscriptions/plan-limits.config';

async function seedPlans(prisma: PrismaClient) {
  const plans = [
    { key: 'FREE', name: PLAN_LIMITS.FREE.name, priceMonthly: 0 },
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

  console.log('Plans seeded successfully.');
}
```

> Use **kobo** (1 NGN = 100 kobo) as the integer unit for all stored monetary values to avoid float precision issues. Convert to naira only at the display/response layer.

---

## 13. Open Questions & Assumptions

The following were assumed during spec authorship. Confirm before implementation begins.

| # | Assumption | Action Required |
|---|---|---|
| 1 | A `User` model already exists in Prisma schema | Confirm field name is `id` — adjust relations if different |
| 2 | The existing payment gateway client is injectable as a NestJS service | Provide the service class name so webhook handler can reference it correctly |
| 3 | New users will select a plan during onboarding (not post-registration) | Confirm the onboarding flow — if post-registration, `createSubscription` must handle users with no existing subscription gracefully |
| 4 | Trial applies to both PRO LITE and PRO PLUS — not FREE | Confirm. If FREE also needs a "trial" concept in future, the schema already supports it |
| 5 | Taps are recorded in an existing `taps` table or similar | Confirm table/model name for daily tap count queries |
| 6 | Analytics history is filtered by `createdAt` on an existing analytics table | Confirm field name so `analyticsHistoryDays` enforcement can be applied correctly |
| 7 | Currency is NGN; gateway handles NGN natively | No conversion logic needed — confirm |
| 8 | Only one subscription is active per user at any time | Schema enforces this via `@unique` on `userId` in `Subscription` — confirm no multi-subscription edge cases exist |

---

*Document prepared for engineering handoff. All schema and code samples are illustrative — adapt naming to match existing codebase conventions before implementation.*
