# Connect-Nest Codebase — Implementation Report
**Period:** May 15 – May 22, 2026

---

## Commit Summary

| Date | Commit | Author | Scope |
|------|--------|--------|-------|
| 2026-05-21 | `98f38b4` | ozigbohub | `feat(connect-plus): add multi-tenant CRM and workspace operations module` |

**Diff size:** 206 files changed · 65,231 insertions · 159 deletions

---

## 1. Overview

A complete **Connect Plus** module was merged into the platform as a purely additive layer on top of the existing connect-nest API. No existing models, endpoints, or enums were broken. All new routes are served under `/api/cp/`.

---

## 2. Database Schema — New Models (18 Cp-prefixed)

| Model | Purpose |
|-------|---------|
| `CpOrganization` | Top-level tenant entity |
| `CpWorkspace` | Sub-organisation unit within an organisation |
| `CpCompanyProfile` | Branding/company info attached to a workspace |
| `CpWorkspaceMember` | Workspace membership & role assignment |
| `CpWorkspaceInvite` | Invitation lifecycle (pending → accepted/declined) |
| `CpStaffProfile` | Extended staff data (title, bio, avatar) |
| `CpConnectCard` | NFC/digital connect card per staff member |
| `CpLead` | Inbound lead capture with pipeline status |
| `CpClient` | Converted lead / existing client record |
| `CpAppointment` | Bookable appointment slots |
| `CpAttendance` | Staff check-in/out with late & overtime flags |
| `CpConversation` | Direct or group messaging thread |
| `CpConversationParticipant` | Participant membership + `lastReadAt` read cursor |
| `CpMessage` | Individual chat message (text, attachments) |
| `CpInvoice` | Invoice with line items, tax, and status tracking |
| `CpInvoiceItem` | Line-item rows on an invoice |
| `CpNotification` | Persisted in-app notification record |
| `CpAuditLog` | Append-only audit trail (no UPDATE/DELETE ever) |

**New enums (14):** `CpRole`, `CpLeadStatus`, `CpClientStatus`, `CpAppointmentStatus`, `CpAttendanceStatus`, `CpMessageType`, `CpInvoiceStatus`, `CpNotificationType`, `CpAuditAction`, and others.

**Existing model changes:** `CardInteraction` received two new nullable FK columns — `workspaceId` and `workspaceMemberId` — existing rows are unaffected.

---

## 3. New NestJS Modules (src/connect-plus/)

### 3.1 Security & Context
- **`CpContextGuard`** — resolves workspace context from JWT + `x-workspace-id` header on every request; attaches `req.cp` (`authUserId`, `workspaceId`, `organizationId`, `role`, `memberId`)
- **`CpRolesGuard` + `@CpRoles()` decorator** — endpoint-level RBAC enforced on top of the context guard

### 3.2 Tenant & Workspace Management
- **OrganizationsModule** — create/fetch organisations; organisation owner management
- **WorkspacesModule** — create/list/update workspaces within an organisation; member management
- **CompanyProfileModule** — upsert workspace branding (logo, colours, address, contact details)
- **InvitesModule** — invite lifecycle management (accept/decline/list)

### 3.3 People Management
- **StaffModule** — invite staff via `isce-auth`, manage staff profiles, roles, and deactivation
- **ClientsModule** — client record CRUD; `assignClient` for reassigning account managers
- **LeadsModule** — lead intake pipeline with `assign`, `reject`, and **Lead→Client conversion** (atomic DB transaction: creates `CpWorkspaceMember` + `CpClient` + `CpConversation` in one step)

### 3.4 Scheduling & Attendance
- **AppointmentsModule** — bookable appointment slots; **public booking endpoint** (no auth required, via `@PublicRoute()`)
- **AttendanceModule** — staff check-in/out with `isLate` and `isOvertime` auto-detection; admin override capability
- **AttendanceScheduler** — daily CRON job for automatic check-out of open sessions (idempotent)
- **AppointmentsScheduler** — daily CRON job sending 24-hour reminder notifications before appointments

### 3.5 Financial
- **InvoicesModule** — full invoice CRUD (draft → sent → paid/overdue); line items with quantities using `Decimal(10,2)` and monetary values using `Decimal(18,4)` — no `Float` in any financial field
- **InvoicesScheduler** — CRON job that transitions unpaid sent invoices to `OVERDUE` status

### 3.6 Communication
- **ChatModule + `CpChatGateway`** — Socket.IO gateway on `/cp` namespace with:
  - Workspace-level rooms and conversation-level rooms
  - JWT authentication on `connect` event
  - `cp:message` and `cp:typing` real-time events
  - Read receipts via `lastReadAt` cursor (no `readBy[]` array on message rows)
- **NotificationsModule** — persists `CpNotification` rows and delivers via email (`MailService`) + FCM push (`DeviceProfile.fcmToken`)

### 3.7 NFC / Connect Cards
- **ConnectCardsModule** — NFC tap handler, tap page config, card enable/disable; tap events feed into analytics

### 3.8 Analytics
- **AnalyticsModule** — workspace-scoped analytics (card taps, lead funnel, appointment conversion); backed by a Bull queue processor (`analytics.processor.ts`) for async aggregation

### 3.9 Public Routes
- **PublicModule** — unauthenticated endpoints: save contact from a tap, public appointment booking page

### 3.10 External Integrations
- **IsceAuthService** — wraps the `isce-auth` service's invite API for both staff and client flows; isolated error handling ensures CP transactions **never roll back** due to auth service failures
- **WebhooksModule** — inbound webhook handler (HMAC-verified) for payment and external event callbacks; uses `utils/hmac.ts` for signature validation

### 3.11 Audit Logging
- **CpAuditLogService** — fire-and-forget, write-once audit entries with `before`/`after` state snapshots on every mutating operation; the `CpAuditLog` table has no `updatedAt`, no `deletedAt`, and no `DELETE` or `UPDATE` endpoint for any role

---

## 4. Supporting Utilities Added

| File | Purpose |
|------|---------|
| `utils/hmac.ts` | HMAC-SHA256 signature generation/verification for webhooks |
| `utils/paginate.ts` | Reusable cursor/offset pagination helper |
| `utils/slug.ts` | Slug generation for workspace/card URLs |
| `common/dto/paginate-query.dto.ts` | Shared pagination DTO with class-validator |
| `types/cp-request.types.ts` | TypeScript types for the `req.cp` context object |
| `decorators/cp-roles.decorator.ts` | `@CpRoles()` metadata decorator |

---

## 5. Infrastructure & Dependencies

- **`package.json`** — 5 new dependencies added (includes Socket.IO, Bull queue, and scheduler packages)
- **`pnpm-lock.yaml`** — updated lockfile (+10,060 lines)
- **`src/app.module.ts`** — `ConnectPlusModule` registered in the root application module
- **`src/main.ts`** — minor update (Socket.IO adapter initialisation)
- **`prisma/schema.prisma`** — 577-line net change adding all 18 models, 14 enums, and 2 FK columns

---

## 6. Documentation Added

All documentation under `docs/connect_plus/`:

| File | Lines |
|------|-------|
| `CONNECT PLUS – DEVELOPER PRD.md` | 936 |
| `CONNECT PLUS – IMPLEMENTATION PLAN.md` | 458 |
| `CONNECT PLUS – UNIFIED MASTER DOCUMENT.md` | 389 |
| `CONNECT PLUS – FULL USER STORY LIST (WITH CREATOR ROLE).md` | 447 |
| `CONNECT PLUS – ROLE-BASED ACCESS CONTROL (RBAC) MATRIX.md` | 149 |
| `CONNECT PLUS – AUDIT & LOGGING RULES.md` | 219 |
| `CONNECT PLUS – FEATURE EXPLANATION.md` | 281 |
| `CONNECT PLUS – PRODUCT REQUIREMENTS DOCUMENT (PRD).md` | 408 |
| `Connect Plus – System Architecture & Data Ownership.md` | 227 |
| `CONNECT_PLUS_PRD_V2.MD` | 920 |
| `docs/PROJECT_SUMMARY.md` | 156 |

---

## 7. Key Engineering Decisions

| Decision | Rationale |
|----------|-----------|
| DB-resolved workspace context | JWT stays minimal (userId only); role is resolved from `CpWorkspaceMember` on every request — no stale role data in tokens |
| `Decimal(18,4)` for money, `Decimal(10,2)` for quantities | No `Float` anywhere in financial data paths |
| `lastReadAt` cursor for read receipts | Avoids expensive `readBy Json[]` array updates on message rows |
| `CpAuditLog` is append-only | No UPDATE/DELETE path for any role; audit history is immutable |
| Auth service failure isolation | `IsceAuthService` errors are caught silently — CP transactions complete even if `isce-auth` is down |
| `npx prisma db push` (no migration files) | Consistent with existing project strategy |

---

**Total scope:** 1 commit · 206 files · ~65,000 lines added · Zero breaking changes to existing API surface.
