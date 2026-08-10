# CONNECT PLUS — IMPLEMENTATION PLAN

> This document defines the build order, deliverables per phase, and acceptance criteria.
> MVP = Phases 1–5. Full v1 = Phases 1–9.

---

## Overview

| Phase | Focus | Deliverables | Priority |
|-------|-------|-------------|----------|
| 1 | Foundation | Auth guard, RBAC, module scaffold | MVP |
| 2 | Org & Workspace | Organizations, workspaces, company profile | MVP |
| 3 | Staff | Staff profiles, invite flow, connect cards | MVP |
| 4 | Lead & Client CRM | Lead capture, validation, client management | MVP |
| 5 | Appointments | Public + client bookings, status lifecycle | MVP |
| 6 | Invoices | Invoice CRUD, line items, lifecycle, PDF | v1 |
| 7 | Chat | Conversations, real-time messages | v1 |
| 8 | Notifications | Event-driven alerts, email routing | v1 |
| 9 | Attendance | Check-in/out, reports, admin overrides | v1 |
| 10 | Analytics | Dashboards, org rollup | v2 |
| 11 | Audit Logs | Write-once logs, role-filtered views | v2 |

---

## Phase 1 — Foundation

**Goal:** Infrastructure that everything else depends on. No business logic yet.

### 1.1 Prisma Schema
- [ ] Add all `Cp*` enums to `schema.prisma`
- [ ] Add all `Cp*` models to `schema.prisma` (see Developer PRD §3)
- [ ] Run `npx prisma db push`
- [ ] Run `npx prisma generate`

### 1.2 Module Scaffold
- [ ] Create `src/connect-plus/` directory
- [ ] Create `ConnectPlusModule` (`connect-plus.module.ts`) — root module that imports all CP sub-modules
- [ ] Register `ConnectPlusModule` in `src/app.module.ts`
- [ ] Create `src/connect-plus/types/cp-request.types.ts`:
  ```typescript
  export interface CpRequestContext {
    authUserId: string;
    workspaceId: string;
    organizationId: string;
    role: string; // CpRole value
    memberId: string;
  }
  ```

### 1.3 CpContextGuard
- [ ] Create `src/connect-plus/guards/cp-context.guard.ts`
- Reads `x-workspace-id` header
- Queries `CpWorkspaceMember` for `{ authUserId: req.isce_auth.id, workspaceId }`
- Throws `ForbiddenException` if not found or suspended
- Attaches `req.cp` with resolved context
- [ ] Create `src/connect-plus/guards/cp-roles.guard.ts`
- Reads `CpRole[]` metadata set by `@CpRoles`
- Checks `req.cp.role` is in allowed list; throws 403 otherwise
- [ ] Create `src/connect-plus/decorators/cp-roles.decorator.ts`
  ```typescript
  export const CP_ROLES_KEY = 'cp_roles';
  export const CpRoles = (...roles: string[]) => SetMetadata(CP_ROLES_KEY, roles);
  ```
- [ ] Create `src/connect-plus/decorators/cp-context.decorator.ts` (param decorator to extract `req.cp`)

### 1.4 CREATOR context (no workspaceId)
- [ ] `CpContextGuard` has a bypass for routes decorated with `@CpCreatorRoute()`
- For creator routes: look up `CpOrganization` by `creatorAuthId = req.isce_auth.id` instead

### Acceptance Criteria
- A request to any `/api/cp/` route without `x-workspace-id` returns 400
- A request with a valid JWT but no membership returns 403
- A request with a suspended member returns 403
- `req.cp` is fully populated for valid requests

---

## Phase 2 — Organization & Workspace

**Goal:** Creator can create an org, create workspaces, and set up the company profile.

### 2.1 Organizations Module
- [ ] `organizations.controller.ts` — routes: POST `/`, GET `/me`, PATCH `/me`, DELETE `/me`
- [ ] `organizations.service.ts`:
  - `create(authUserId, dto)` — creates `CpOrganization`; creator auto-becomes the owner
  - `getMyOrg(authUserId)` — finds by `creatorAuthId`
  - `update(orgId, dto)`
  - `archive(orgId)`
- [ ] `dto/create-organization.dto.ts` — `name: string`, `slug: string`
- [ ] `dto/update-organization.dto.ts` — partial of above + `settings`

### 2.2 Workspaces Module
- [ ] `workspaces.controller.ts` — routes per API contract §5.2
- [ ] `workspaces.service.ts`:
  - `create(orgId, dto)` — creates `CpWorkspace` + auto-creates `WORKSPACE_GROUP` conversation + seeds empty `CpCompanyProfile`
  - `list(orgId)` — all workspaces for an org
  - `get(workspaceId)`
  - `update(workspaceId, dto)`
  - `setStatus(workspaceId, status)` — ACTIVE | SUSPENDED | ARCHIVED
  - `inviteAdmin(workspaceId, email)` — calls isce-auth invite endpoint; creates pending `CpWorkspaceMember`
- [ ] `dto/create-workspace.dto.ts`
- [ ] `dto/update-workspace.dto.ts`

### 2.3 Company Profile Module
- [ ] `company-profile.controller.ts` — GET `/`, PUT `/`
- [ ] `company-profile.service.ts`:
  - `get(workspaceId)`
  - `upsert(workspaceId, dto)`
- [ ] `dto/upsert-company-profile.dto.ts` — all profile fields, all optional except `name`

### Acceptance Criteria
- Creator can create an org and multiple workspaces
- Company profile is auto-seeded on workspace creation (with workspace name only)
- Workspace Admin can update the company profile
- A STAFF member cannot update the company profile (403)
- Archived workspaces return 403 on all operations

---

## Phase 3 — Staff Management & Connect Cards

**Goal:** Workspace Admin can invite staff, manage their profiles, and pair connect cards.

### 3.1 Staff Module
- [ ] `staff.controller.ts` — routes per API contract §5.4
- [ ] `staff.service.ts`:
  - `inviteStaff(workspaceId, dto)` — calls `AUTH_API_URL/internal/invite`; creates `CpWorkspaceMember { role: STAFF, status: ACTIVE }` + `CpStaffProfile` (partial, filled on join)
  - `list(workspaceId)` — all staff with profiles
  - `get(workspaceId, staffId)`
  - `update(staffId, dto)`
  - `setStatus(memberId, status)` — ACTIVE | SUSPENDED | REMOVED
  - `changeRole(memberId, newRole)` — STAFF ↔ WORKSPACE_ADMIN
- [ ] When invited staff completes auth signup → an internal webhook/callback from isce-auth updates `member.joinedAt`
- [ ] `dto/invite-staff.dto.ts` — `email: string`, `name: string`, `jobTitle?: string`, `department?: string`
- [ ] `dto/update-staff.dto.ts`

### 3.2 Connect Cards Module (inside staff module)
- [ ] `createCard(workspaceId, dto)` — creates unpaired `CpConnectCard` with unique `cardCode`
- [ ] `pairCard(cardId, staffId)` — sets `staffId`, `isActive = true`, `pairedAt = now()`
- [ ] `unpairCard(cardId)` — clears `staffId`, `isActive = false`
- [ ] Card code generation: `uuid` shortened to 8 chars (uppercase), collision-checked

### Acceptance Criteria
- Staff invite creates both `WorkspaceMember` and `StaffProfile`
- Suspended staff get 403 on all authenticated requests (enforced by CpContextGuard)
- Only WORKSPACE_ADMIN can pair/unpair cards
- A card cannot be paired to two staff simultaneously

---

## Phase 4 — Lead & Client CRM

**Goal:** Capture leads from card taps, validate them to clients, manage client relationships.

### 4.1 Public Routes Module
- [ ] `public.controller.ts` — all routes `@PublicRoute()`
- Routes:
  - `GET /api/cp/public/:workspaceSlug` → company profile
  - `POST /api/cp/public/:workspaceSlug/appointments` → book appointment as lead
  - `POST /api/cp/public/:workspaceSlug/interactions` → log card tap/QR scan
  - `POST /api/cp/public/:workspaceSlug/contacts/save` → log contact-save event
- [ ] Resolve workspace from `workspaceSlug` on every public request
- [ ] `public.service.ts`:
  - `bookPublicAppointment(workspaceId, dto)` — creates `CpLead` (status: NEW) + `CpAppointment` (type: PUBLIC)
  - `logInteraction(workspaceId, dto)` — creates `CpLead` if new email/phone
  - `getPublicProfile(workspaceSlug)` — returns `CpCompanyProfile` + workspace name

### 4.2 Leads Module
- [ ] `leads.controller.ts` — routes per API contract §5.6
- [ ] `leads.service.ts`:
  - `list(workspaceId, filters)` — filter by status, assignedStaffId, date range
  - `get(workspaceId, leadId)`
  - `assign(leadId, staffId)` — sets `assignedStaffId`
  - `validate(leadId, ctx)` — **core flow:**
    1. Creates `CpClient` from lead data
    2. Creates `CpWorkspaceMember { role: CLIENT }`
    3. Calls `AUTH_API_URL/internal/invite` with client email
    4. Creates `CLIENT_STAFF` conversation between client and assigned staff
    5. Updates `CpLead.status = CONVERTED`
    6. Sends notification to staff + admin
    7. Writes audit log
  - `reject(leadId, ctx)` — sets `status = REJECTED`, writes audit log
  - `delete(leadId)` — soft delete
- [ ] `dto/list-leads.dto.ts`

### 4.3 Clients Module
- [ ] `clients.controller.ts` — routes per API contract §5.7
- [ ] `clients.service.ts`:
  - `list(workspaceId)` — all clients (admin)
  - `listAssigned(workspaceId, staffId)` — for STAFF
  - `get(workspaceId, clientId, ctx)` — STAFF can only get assigned clients
  - `reassign(clientId, newStaffId)` — admin reassigns; adds new staff to existing conversation
  - `getMyProfile(ctx)` — for CLIENT role

### Acceptance Criteria
- Visitor can book an appointment without a login
- A `CpLead` is created on every public card interaction
- Validating a lead creates a client, sends an invite email via isce-auth, and creates the chat conversation
- STAFF cannot see clients assigned to other staff members (403)
- CLIENT can only see their own profile

---

## Phase 5 — Appointments

**Goal:** Staff can manage appointments; clients can book and view their own.

### 5.1 Appointments Module
- [ ] `appointments.controller.ts` — routes per API contract §5.8
- [ ] `appointments.service.ts`:
  - `create(workspaceId, dto, ctx)` — staff creates on behalf of client
  - `list(workspaceId, filters)` — admin sees all; staff sees assigned
  - `get(id, ctx)`
  - `updateStatus(id, status, ctx)` — CONFIRMED / COMPLETED / CANCELLED / NO_SHOW
  - `update(id, dto, ctx)` — update time/notes
  - `listMine(ctx)` — CLIENT sees own appointments
- [ ] Appointment conflict check: warn if `staffId` has overlapping appointment in same time window
- [ ] `dto/create-appointment.dto.ts` — `clientId | leadId`, `scheduledAt`, `title`, `reason?`, `staffId?` 
- [ ] `dto/update-appointment-status.dto.ts`

### Acceptance Criteria
- Public appointments (from Phase 4) are listed alongside internal appointments
- Status machine: PENDING → CONFIRMED → COMPLETED (or CANCELLED, NO_SHOW)
- CLIENT can see their own appointments via `GET /me` 
- Cancelling an appointment sends a notification to the relevant party

---

## Phase 6 — Invoices

**Goal:** Staff create invoices for clients; admin manages lifecycle.

### 6.1 Invoices Module
- [ ] `invoices.controller.ts` — routes per API contract §5.10
- [ ] `invoices.service.ts`:
  - `create(workspaceId, dto, ctx)` — staff can only invoice assigned clients
  - `list(workspaceId, ctx)` — admin sees all; staff sees own
  - `get(id, ctx)` — staff/admin/client (own)
  - `update(id, dto, ctx)` — only DRAFT invoices; WORKSPACE_ADMIN can edit any draft
  - `send(id, ctx)` — DRAFT → SENT; notifies client
  - `markPaid(id, dto)` — WORKSPACE_ADMIN only; SENT|OVERDUE → PAID; immutable after
  - `cancel(id)` — WORKSPACE_ADMIN only
  - `generatePdf(id)` — returns PDF buffer
- [ ] Auto-increment invoice number: `INV-{workspaceSlug}-{sequence}` (e.g. `INV-ACME-001`)
- [ ] A cron job runs daily: marks invoices as OVERDUE if `dueDate < now` and `status = SENT` 
- [ ] `dto/create-invoice.dto.ts` — `clientId`, `items[]`, `dueDate?`, `notes?`, `currency?` 
- [ ] `dto/invoice-item.dto.ts` — `description`, `quantity`, `unitPrice` 
- [ ] `dto/mark-paid.dto.ts` — `paidVia`, `externalRef?` 

### Acceptance Criteria
- Staff cannot invoice a client that isn't assigned to them (403)
- Paid invoices cannot be edited (403 on PATCH)
- Audit log written on every status change
- Client receives email notification when invoice is sent
- Invoice PDF is downloadable by client and admin

---

## Phase 7 — Chat & Messaging

**Goal:** Real-time staff group chat, direct staff-to-staff, and client-staff channel.

### 7.1 Chat Module
- [ ] `chat.controller.ts` — REST routes per API contract §5.9
- [ ] `chat.service.ts`:
  - `listConversations(ctx)` — conversations the user is a participant in
  - `getMessages(conversationId, ctx, pagination)` 
  - `sendMessage(conversationId, dto, ctx)` — creates `CpMessage`; emits Socket.IO event
  - `markRead(conversationId, ctx)` — updates `readBy` array for all unread messages
  - `createDirect(workspaceId, targetAuthUserId, ctx)` — creates DIRECT conversation or returns existing
- [ ] `chat.gateway.ts` (Socket.IO):
  - On connect: validate JWT, join `workspace:{workspaceId}` room
  - Events: `cp:send-message`, `cp:message-received`, `cp:typing`, `cp:read` 
  - Clients can only join conversations they are participants in
- [ ] `dto/send-message.dto.ts` — `content: string`, `attachments?: [...]` 

### Acceptance Criteria
- GROUP conversation is auto-created when a workspace is created (Phase 2)
- Staff cannot send messages to conversations they are not in
- CLIENT can only message in their CLIENT_STAFF conversation
- Messages persist in DB — Socket.IO is only the delivery layer
- Pagination on message history (cursor-based, newest first)

---

## Phase 8 — Notifications

**Goal:** Event-driven in-app and email notifications routed by role.

### 8.1 Notifications Module
- [ ] `cp-notifications.service.ts`:
  - `send(dto: CpSendNotificationDto)` — writes `CpNotification` record + triggers email if needed
  - Called by all other services after key events (inject as dependency)
- [ ] `notifications.controller.ts` — `GET /`, `PATCH /:id/read`, `PATCH /read-all` 
- [ ] Email templates needed:
  - Appointment booked (lead/client)
  - Invoice issued / overdue
  - Workspace invite (staff / admin)
  - Client validation completed
- [ ] `dto/cp-send-notification.dto.ts` — `recipientAuthId`, `type`, `workspaceId?`, `title`, `message`, `metadata?` 

### 8.2 Wiring Notifications to Events
Connect `cp-notifications.service.ts` to:
- [ ] Lead validated → notify assigned staff + workspace admin
- [ ] Appointment created → notify staff; notify lead/client via email
- [ ] Appointment status changed → notify client
- [ ] Invoice sent → notify client
- [ ] Invoice overdue (cron) → notify client + workspace admin
- [ ] Staff invited → send invite email via isce-auth + in-app notification
- [ ] New chat message → in-app notification to offline participants

### Acceptance Criteria
- All key events produce a `CpNotification` record
- Email is sent for appointment and invoice events (lead email, no auth required)
- Marking all as read clears the unread count for that user
- Notifications are scoped — a STAFF member cannot see another staff member's notifications

---

## Phase 9 — Attendance

**Goal:** Staff check in/out; admin monitors and can override.

### 9.1 Attendance Module
- [ ] `attendance.controller.ts` — routes per API contract §5.5
- [ ] `attendance.service.ts`:
  - `checkIn(workspaceId, staffId, dto)` — creates record; blocks if already checked in today
  - `checkOut(workspaceId, staffId, dto)` — closes open record; calculates `hoursWorked`, sets `isLate` / `isOvertime` 
  - `list(workspaceId, filters)` — admin: all staff; staff: own
  - `getStaffAttendance(staffId, dateRange)` 
  - `override(recordId, dto, ctx)` — admin adjusts check-in/out times; writes audit log
- [ ] Late detection: compare `checkIn` time against `CompanyProfile.businessHours` for that weekday
- [ ] Overtime detection: `hoursWorked > 8` (configurable in company profile `invoiceDefaults`)
- [ ] Midnight cron: auto-check-out any open records

### Acceptance Criteria
- A staff member cannot check in twice on the same day without checking out first
- `isLate` is set if check-in is after the workspace's defined start time
- Admin override creates an audit log entry
- Staff can only see their own attendance; admin sees all

---

## Phase 10 — Analytics

**Goal:** Role-appropriate metrics dashboards.

### 10.1 Analytics Module
- [ ] `analytics.service.ts` — all read-only aggregate queries
- [ ] Workspace Admin analytics endpoints:
  - Attendance: total hours, late count, overtime, daily breakdown (filter by staff, date range)
  - Clients: new clients per period, engagement frequency
  - Appointments: volume, completion rate, no-show rate
  - Invoices: total billed, total paid, overdue amount, avg invoice value
  - Staff performance: appointment count, client count, message activity per staff
- [ ] Creator analytics endpoint:
  - Per-workspace: client count, invoice total, appointment count, active staff count
  - Org totals (aggregated across all workspaces)
- [ ] Staff self-analytics:
  - Own attendance summary
  - Own appointment stats
  - Own client count

### Acceptance Criteria
- All analytics queries filter by `workspaceId` (or `organizationId` for CREATOR)
- No raw PII in analytics responses — counts and aggregates only
- Response is fast: use Prisma aggregations + `groupBy`, not in-memory computation

---

## Phase 11 — Audit Logs

**Goal:** Immutable, role-filtered audit trail for all key operations.

### 11.1 Audit Logs Module
- [ ] `cp-audit.service.ts` — `write(dto: CpAuditWriteDto)` — called fire-and-forget by all services
- [ ] `audit-logs.controller.ts` — `GET /` (workspace admin) with filters: staff, date range, entity, action
- [ ] No PATCH or DELETE endpoints
- [ ] Export endpoint: `GET /audit-logs/export` → CSV (WORKSPACE_ADMIN only)

### 11.2 Audit Integration Checklist
Wire `cpAuditService.write(...)` into:
- [ ] Invoice: create, send, mark-paid, cancel, edit
- [ ] Lead: validate, reject, assign
- [ ] Client: reassign
- [ ] Staff: invite, suspend, remove, role-change
- [ ] Attendance: check-in, check-out, override
- [ ] Workspace: create, status change, admin invite
- [ ] Organization: create, settings update

### Acceptance Criteria
- Every financial action (invoice) has an audit entry
- Logs cannot be deleted via any API
- WORKSPACE_ADMIN can filter logs by staff member, date, and entity
- CREATOR can see org-level events only (no client PII)

---

## Cross-Cutting Concerns (All Phases)

### Error Handling
- All services use the same pattern as existing connect-nest modules:
  ```typescript
  try { ... } catch (error) {
    if (error instanceof HttpException) throw error;
    throw new InternalServerErrorException('...');
  }
  ```

### Soft Deletes
- All queries on deletable models must include `where: { deletedAt: null }` 
- Provide a shared Prisma extension or helper for this if it becomes repetitive

### Swagger
- Every endpoint needs `@ApiTags('Connect Plus - <Module>')`, `@ApiOperation`, `@ApiResponse`, `@ApiBearerAuth` 
- Add `@ApiHeader({ name: 'x-workspace-id', required: true })` to all authenticated CP controllers

### Data Isolation Invariant
- Every service method must receive and use `workspaceId` from `req.cp` — never from the request body or path params directly without cross-checking against `req.cp.workspaceId` 

---

## Build Order Summary (Dependency Graph)

```
Phase 1 (Foundation)
    └── Phase 2 (Org + Workspace)
            ├── Phase 3 (Staff)
            │       └── Phase 9 (Attendance) ← depends on StaffProfile
            ├── Phase 4 (Lead + Client CRM) ← depends on Workspace + Staff
            │       └── Phase 5 (Appointments) ← depends on Lead + Client
            │               └── Phase 8 (Notifications) ← depends on all events
            └── Phase 6 (Invoices) ← depends on Client + Staff
Phase 7 (Chat) ← depends on Phase 4 (client-staff conversation on validation)
Phase 10 (Analytics) ← depends on Phases 3, 4, 5, 6, 9
Phase 11 (Audit Logs) ← can be wired in starting Phase 2, completed last
```

**Safe build sequence:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11

---

## MVP Checklist (Phases 1–5)

When phases 1–5 are complete, the following is fully operational:

- [ ] Creator can create an organization and multiple workspaces
- [ ] Company profile is set up per workspace (public-facing)
- [ ] Workspace Admin can invite staff and manage their profiles
- [ ] Connect Cards can be created and paired to staff
- [ ] Visitors can tap a card and book a public appointment (no login needed)
- [ ] A `CpLead` is created for every card interaction
- [ ] Staff can validate leads — triggering client account creation + email invite
- [ ] Staff can see and manage their assigned clients
- [ ] Staff and admin can manage appointments with full status lifecycle
- [ ] Client can log in and view their appointments
- [ ] RBAC is enforced — every role sees only what they are allowed to see