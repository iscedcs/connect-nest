# Connect & Connect Plus — Production Deployment Roadmap & Audit

> **Target Repository:** `connect-nest`  
> **Scope:** Connect (Personal) & Connect Plus (Business)  
> **Status:** Production Readiness Specification & Verification Roadmap  
> **File Location:** `docs/CONNECT_AND_CONNECT_PLUS_PRODUCTION_ROADMAP.md`

---

## 1. Executive Summary & Audit Overview

This document presents a complete audit cross-referencing all 18 specification documents against the `connect-nest` codebase.

- **Connect (Personal):** All core multi-profile resource modules (Profiles, Socials, Links, Videos, Files, Meetings, Forms, Wallets) and the unified public profile API (`GET /api/public/profile/:deviceId`) are implemented.
- **Connect Plus (Business):** All 11 core enterprise modules (Organizations, Workspaces, Staff, Cards, Leads, Clients, Appointments, Chat, Invoices, Attendance, Analytics, Audit Logs) are implemented.
- **Artisan Platform:** Profile, category, booking, review, promotion, and 2.5% fee split in `wallet-nest` are completed.
- **Remaining Work:** Focuses on database seeding, dynamic admin pricing, pluggable payment architecture, 6-month trial lifecycle (starting from account creation), Connect Plus limit enforcement, cloud file storage, and production environment security.

---

## 2. Comparative Matrix: Documentation Specs vs. Codebase Implementation

| Module / Area | Feature | Specification Document | Codebase Implementation | Status & Remaining Work |
| :--- | :--- | :--- | :--- | :--- |
| **Connect Personal** | Multi-Profile Resources | `Multi-Profile-Connect-API-Documentation.md` | `src/profile/`, `src/social/`, `src/links/`, `src/videos/`, etc. | ✅ **Complete** |
| **Connect Personal** | Unified Public Profile API | `NEW_API_ENDPOINT_REQUEST_FOR_CONNECT.md` | `src/profile/profile.controller.ts` (`GET /api/public/profile/:deviceId`) | ✅ **Complete** |
| **Connect Personal** | Personal Subscription Engine | `src/docs/subscription-plan.md` | `src/subscriptions/` (`SubscriptionsService`, `SubscriptionsController`) | 🟡 **Needs Plan DB Seeding & Auto-Bootstrap** |
| **Connect Personal** | Admin Dynamic Pricing | Admin Price Management Spec | Not implemented | 🔴 **Needs `PATCH /subscriptions/admin/plans/:planKey` API** |
| **Connect Personal** | Pluggable Payment Gateway | Multi-Gateway Requirement | `initiate-payment` stub | 🔴 **Needs Strategy/Adapter pattern (`PaymentGatewayProvider`)** |
| **Connect Personal** | Cloud Storage & Presigned URLs | File Storage Spec | Local / Spaces URL stub (`files.service.ts`) | 🔴 **Needs DigitalOcean Spaces / S3 SDK integration** |
| | | | | |
| **Connect Plus** | Org, Workspace & Staff Scaffolding | `CONNECT PLUS – DEVELOPER PRD.md` | `src/connect-plus/organizations`, `workspaces`, `staff`, `connect-cards` | ✅ **Complete** |
| **Connect Plus** | Lead & Client CRM | `CONNECT PLUS – REMAINING WORK.md` | `src/connect-plus/leads`, `clients` | ✅ **Complete** |
| **Connect Plus** | Appointments & WebSocket Chat | `CONNECT PLUS – PRD` | `src/connect-plus/cp-appointments`, `chat` (`CpChatGateway`) | ✅ **Complete** |
| **Connect Plus** | Operations & Audit | `CONNECT PLUS – AUDIT & LOGGING RULES.md` | `src/connect-plus/invoices`, `attendance`, `analytics`, `audit-logs` | ✅ **Complete** |
| **Connect Plus** | 6-Month Trial & Limits | `CONNECT PLUS – REMAINING WORK.md` | `src/connect-plus/subscriptions/subscriptions.service.ts` | 🔴 **Needs trial fields in `CpSubscription` & real `checkLimit()` enforcement** |
| | | | | |
| **Artisan Feature** | Directory, Bookings & Wallet Fee | `ARTISAN_IMPLEMENTATION_PLAN.md` | `src/artisan/`, `wallet-nest` fee split | ✅ **Complete** |
| | | | | |
| **Production Readiness**| Service Security & Env Check | Production Readiness Guidelines | Basic headers in `WalletClientService` | 🔴 **Needs `@nestjs/config` validation & `X-Internal-Secret` hardening** |

---

## 3. Technical Breakdown of Remaining Work

### Priority 1: Plan Seeding & Admin Dynamic Pricing API
1. **Plan Seeding Script (`scripts/seed-plans.ts`)**
   - Seed database rows for `PlanTier.FREE` (₦0), `PlanTier.PRO_LITE` (₦1,000 / 100000 kobo), and `PlanTier.PRO_PLUS` (₦1,500 / 150000 kobo).
2. **Admin Dynamic Pricing Endpoint**
   - Route: `PATCH /subscriptions/admin/plans/:planKey`
   - DTO (`UpdatePlanPriceDto`): `priceMonthly` (number in kobo), `name` (optional string), `isActive` (optional boolean).
   - Updates `Plan` database row instantly so future checkouts and renewals reflect the updated pricing without code changes.

### Priority 2: 6-Month Free Trial Auto-Bootstrap (Account Creation)
1. **Connect Personal Onboarding**
   - In `ProfileService.createProfile()`, auto-create subscription:
     ```typescript
     await this.subscriptionsService.createSubscription(user.id, PlanTier.FREE, true);
     ```
   - Trial window: 6 months starting on **account creation date** (`trialStartDate = createdAt`, `trialEndDate = createdAt + 6 months`).
2. **Connect Plus Onboarding**
   - In `CpOrganizationsService.create()`, initialize 6-month trial window (`trialStartsAt = createdAt`, `trialEndsAt = createdAt + 6 months`).

### Priority 3: Pluggable Payment Gateway Architecture (Adapter Pattern)
1. **Gateway Interface (`PaymentGatewayProvider`)**
   - Abstract contract defining `createCheckoutSession()`, `chargeRecurring()`, `verifyWebhookSignature()`, and `handleWebhookEvent()`.
2. **Implementations**:
   - `PaydestalGatewayProvider`
   - `PaystackGatewayProvider`
   - `WalletProxyGatewayProvider`
3. **Gateway Factory**:
   - `PaymentGatewayFactory.getProvider(gatewayName)` allowing switching active gateways via environment variable or DB config.

### Priority 4: Connect Plus Schema Extension & Real Limit Enforcement
1. **Schema Extension (`prisma/schema.prisma`)**:
   - Add `trialStartsAt`, `trialEndsAt`, `targetPlan`, `trialUsed` to `CpSubscription`.
2. **Real Limit Enforcement**:
   - Replace `checkLimit()` stub in `CpSubscriptionsService` with real database count checks:
     - Workspaces per org limit
     - Staff members per workspace limit
     - Clients per workspace limit

### Priority 5: Cloud File Storage (DigitalOcean Spaces / S3)
1. **Cloud SDK Integration in `FilesService`**:
   - Configure AWS SDK / DigitalOcean Spaces client using `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` / `SPACES_ENDPOINT`.
2. **Presigned URLs**:
   - `generatePresignedUploadUrl()` for client direct upload.
   - `generatePresignedDownloadUrl()` for secure private file downloads.

### Priority 6: Production Environment Security & Validation
1. **Strict Environment Validation**:
   - Add Joi / Class-Validator schema in `ConfigModule.forRoot()` checking for required production keys before NestJS boot.
2. **Service Security**:
   - Enforce `X-Internal-Secret` header on all HTTP requests between `connect-nest`, `wallet-nest`, and `isce-auth`.

---

## 4. Production Readiness Execution Checklist

- [ ] **Step 1**: Run plan seeding script `ts-node scripts/seed-plans.ts`.
- [ ] **Step 2**: Implement Admin Dynamic Plan Pricing `PATCH /subscriptions/admin/plans/:planKey`.
- [ ] **Step 3**: Wire 6-month trial auto-bootstrap into `createProfile()` and `createOrganization()`.
- [ ] **Step 4**: Implement Pluggable `PaymentGatewayProvider` Strategy & webhook handlers.
- [ ] **Step 5**: Extend `CpSubscription` schema and implement real `checkLimit()` enforcement in Connect Plus.
- [ ] **Step 6**: Implement DigitalOcean Spaces / S3 physical upload and presigned URL generation in `FilesService`.
- [ ] **Step 7**: Add `@nestjs/config` production schema validation and `X-Internal-Secret` security headers.
- [ ] **Step 8**: Run full test suite `npm run test` & `npm run test:e2e` and verify clean build `npm run build`.
