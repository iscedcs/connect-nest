# Connect & Connect Plus — Remaining Implementation Tasks

> **Status Tracking Document**  
> **Target Codebase:** `connect-nest` (NestJS + Prisma + Neon PostgreSQL)  
> **Last Updated:** August 2026  
> **File Location:** `docs/REMAINING_IMPLEMENTATION_TASKS.md`

---

## 1. Executive Summary

This document consolidates all outstanding tasks identified across the documentation suite (`docs/connect_plus/`, `docs/subscription-plan.md`, `docs/SUBSCRIPTION_IMPLEMENTATION_STATUS.md`, and `docs/CONNECT_AND_CONNECT_PLUS_PRODUCTION_ROADMAP.md`).

---

## 2. Outstanding Implementation Checklist

### Priority 1: Subscription Payment & Billing Lifecycle (Personal & Business)
*References: `docs/subscription-plan.md`, `docs/SUBSCRIPTION_IMPLEMENTATION_STATUS.md`*

- [x] **Real Payment Gateway Integration (`POST /api/subscriptions/initiate-payment`)**
  - Replaced stub with pluggable adapter pattern (`PaymentGatewayProvider`, `PaymentGatewayFactory`) supporting Paystack and Paydestal.
- [x] **Payment Webhook Handler**
  - Implemented `PaymentWebhookController` (`POST /api/subscriptions/webhooks/paystack` & `paydestal`) verifying signatures, recording `PaymentRecord`, calling `upgradePlan()`, and dispatching `SUBSCRIPTION_ACTIVATED`.
- [x] **Admin Dynamic Pricing Endpoint**
  - Implemented `PATCH /subscriptions/admin/plans/:planKey` using `UpdatePlanPriceDto` (`priceMonthly`, `name`, `isActive`) for dynamic DB pricing updates.
- [x] **6-Month Free Trial Auto-Bootstrap (Account Creation)**
  - **Connect Personal:** Auto-initializes 6-month trial window upon first profile creation in `ProfileService.createProfile()`.
  - **Connect Plus:** Auto-initializes 6-month trial window upon organization creation in `CpOrganizationsService.create()`.
- [x] **Automated Trial Expiry & Downgrade Cron Jobs**
  - Verified daily `@Cron` jobs handling transitions from `TRIALING` → `EXPIRED` → downgrade to `FREE`.

---

### Priority 2: Connect Plus Real Limit Enforcement & Schema Extensions
*References: `docs/connect_plus/CONNECT PLUS – REMAINING WORK.md`, `docs/connect_plus/CONNECT_PLUS_PRD_V2.MD`*

- [x] **`CpSubscription` Schema Extension (`prisma/schema.prisma`)**
  - Added `trialStartsAt`, `trialEndsAt`, `targetPlan`, and `trialUsed` to the `CpSubscription` model.
- [x] **Real Resource Limit Enforcement in `CpSubscriptionsService.checkLimit()`**
  - Enforced real database count queries for Workspaces per Organization, Staff per Workspace, and Clients per Workspace.

---

### Priority 3: Cloud File Storage (DigitalOcean Spaces / AWS S3)
*References: `docs/CONNECT_AND_CONNECT_PLUS_PRODUCTION_ROADMAP.md`*

- [x] **S3 / Spaces SDK Physical Uploads**
  - Integrated `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` into `FilesService`.
- [x] **Presigned URLs**
  - Implemented `POST /profiles/:profileId/files/presigned-upload-url` and time-limited signed download URLs in `GET /profiles/:profileId/files/download/:id`.
  - Implemented physical deletion via `DeleteObjectCommand` in `permanentDelete`.

---

### Priority 4: Analytics History Limit Completion
*References: `docs/SUBSCRIPTION_IMPLEMENTATION_STATUS.md`*

- [x] **Card Interaction Date Filtering**
  - Applied `limits.analyticsHistoryDays` date range filters to `getInteractionsByMethod`, `getInteractionsByDevice`, `getRecentInteractions`, `getInteractionStats`, and `getInteractionsByDateRange`.

---

### Priority 5: Production Environment Validation & Service Security
*References: `docs/CONNECT_AND_CONNECT_PLUS_PRODUCTION_ROADMAP.md`*

- [x] **Boot-Time Strict Environment Validation**
  - Implemented class-validator based `validate` function in `src/config/env.validation.ts` wired into `ConfigModule.forRoot({ validate })`.
- [x] **Microservice Internal API Security**
  - Enforced resilient `X-Internal-Secret` / `X-Internal-Api-Key` validation in `InternalGuard`.

---

### Priority 6: Tier Feature Flags (Pending Dedicated Feature Services)
*References: `src/subscriptions/plan-limits.config.ts`*

These limits are configured in `PLAN_LIMITS` and will have `@PlanFeature` / `PlanLimitGuard` attached once their respective feature modules are developed:
- [ ] **Theme Customization** (`themeCustomization`)
- [ ] **Contact / vCard Export** (`contactExport`)
- [ ] **Remove ISCE Branding** (`removeIsceBranding`)
- [ ] **Verified Badges** (`verifiedBadge`)
- [ ] **Priority Support** (`prioritySupport`)
- [ ] **Priority Ranking** (`priorityRanking`)

---

## 3. Completed Modules & Features Audit

The following modules and features are **100% implemented and passing type checks (`npx tsc --noEmit: 0 errors`)**:

| Module Area | Features Completed |
| :--- | :--- |
| **Connect Personal** | Profiles, Socials, Links, Videos, Files, Meetings, Spotify, Wallets, Custom Forms |
| **Public Gateway** | Unified Public Profile API (`GET /api/public/profile/:deviceId`) |
| **Connect Plus (Business)** | Organizations, Workspaces, Staff, Connect Cards, Leads CRM, Client CRM, Appointments, WebSockets Chat, Invoices, Attendance, Analytics, Audit Logs |
| **Artisan Platform** | Directory, Services, Bookings, Reviews, Promotions, Admin Settings, and 2.5% fee split in `wallet-nest` |
| **Personal Subscriptions** | Core engine (`SubscriptionsService`, `SubscriptionsController`, `PlanLimitGuard`, tier limit configuration in `plan-limits.config.ts`) |
| **Database & Seeding** | Prisma Schema, `prisma/seed.ts` (Plan catalogue: FREE, Pro Lite, Pro Plus), `scripts/seed-artisan-categories.ts` |
