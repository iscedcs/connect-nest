# CONNECT PLUS — DEVELOPER PRD

> This document translates the concept docs into a technical specification for builders.
> It covers: architecture decisions, JWT integration, Prisma schema, module structure, API contract, and RBAC enforcement.

---

## 1. Architecture Decisions

### 1.1 Repository
Connect Plus is built as **new modules inside connect-nest** (same repo, branch `cplus`). All modules live under `src/connect-plus/`. They share:
- The same `DatabaseService` (PrismaService)
- The same JWT validation (`AuthGuard`)
- The same global pipes, rate limiting, and Helmet config

### 1.2 URL Namespace
All Connect Plus routes are prefixed `/api/cp/` to avoid collisions with existing connect-nest routes.

### 1.3 Auth & Workspace Context
isce-auth issues JWTs with payload `{ id, email, phone, firstName, lastName, displayPicture, userType }`.

Connect Plus does **not** modify isce-auth. Instead:
- The client passes `x-workspace-id` as a request header on every authenticated request
- A `CpContextGuard` (separate from the global `AuthGuard`) resolves the user's role by querying `WorkspaceMember` table
- The resolved context is attached to `request.cp` for use in controllers and services

```
request.cp = {
  authUserId: string,        // from JWT id
  workspaceId: string,       // from x-workspace-id header
  organizationId: string,    // resolved from workspace
  role: CpRole,              // resolved from WorkspaceMember
  memberId: string,          // WorkspaceMember.id
}
```

For **public endpoints** (card tap, book appointment), `x-workspace-id` is part of the route param or public slug — no JWT required. These use `@PublicRoute()` already defined in the codebase.

### 1.4 Database
Same Neon PostgreSQL instance, new models added to `prisma/schema.prisma`. All Connect Plus models are prefixed `Cp` to prevent name collisions (e.g. `CpAppointment` instead of `Appointment` which already exists in the personal card module).

### 1.5 Real-Time Chat
Uses Socket.IO (already installed for artisan threads). A new `CpChatGateway` will be added with workspace-scoped rooms.

### 1.6 File Storage
Re-uses the same DigitalOcean Spaces setup already referenced in the files module for invoice attachments and portfolio items.

---

## 2. Role Model

```typescript
enum CpRole {
  CREATOR          // Organization owner — cross-workspace visibility
  WORKSPACE_ADMIN  // Full control within one workspace
  STAFF            // Operates within assigned clients/tasks
  CLIENT           // Validated user — limited to own data
  VISITOR          // Unauthenticated — public routes only
}
```

**Scope hierarchy:**
```
Platform
└── Organization  (CREATOR owns)
    └── Workspace (WORKSPACE_ADMIN manages)
        ├── Staff    (STAFF role)
        └── Clients  (CLIENT role)
```

---

## 3. Prisma Schema — New Models

Add all of the following to `prisma/schema.prisma`.

### 3.1 Enums

```prisma
enum CpOrgStatus {
  ACTIVE
  SUSPENDED
  ARCHIVED
}

enum CpWorkspaceStatus {
  ACTIVE
  SUSPENDED
  ARCHIVED
}

enum CpMemberStatus {
  ACTIVE
  SUSPENDED
  REMOVED
}

enum CpLeadSource {
  CARD_TAP
  QR_SCAN
  MANUAL
  FORM_SUBMIT
}

enum CpLeadStatus {
  NEW
  CONTACTED
  VALIDATED
  REJECTED
  CONVERTED  // Lead became a Client
}

enum CpAppointmentType {
  PUBLIC   // Booked by a visitor/lead via card tap
  CLIENT   // Booked by a validated client
}

enum CpAppointmentStatus {
  PENDING
  CONFIRMED
  RESCHEDULED
  COMPLETED
  CANCELLED
  NO_SHOW
}

enum CpConversationType {
  WORKSPACE_GROUP  // All staff in workspace
  DIRECT           // Staff-to-staff
  CLIENT_STAFF     // One client <-> assigned staff
}

enum CpSenderRole {
  STAFF
  CLIENT
  SYSTEM
}

enum CpInvoiceStatus {
  DRAFT
  SENT
  PAID
  OVERDUE
  CANCELLED
}

enum CpNotificationType {
  APPOINTMENT_BOOKED
  APPOINTMENT_CONFIRMED
  APPOINTMENT_RESCHEDULED
  APPOINTMENT_CANCELLED
  LEAD_ASSIGNED
  LEAD_VALIDATED
  CLIENT_INVITED
  CLIENT_MESSAGE
  INVOICE_ISSUED
  INVOICE_OVERDUE
  INVOICE_PAID
  INVOICE_CANCELLED
  ATTENDANCE_LATE
  ATTENDANCE_OVERRIDE
  WORKSPACE_INVITE_SENT
  WORKSPACE_INVITE_ACCEPTED
  STAFF_SUSPENDED
  STAFF_REMOVED
  WORKSPACE_CREATED
  WORKSPACE_SUSPENDED
  ORG_ALERT
  NEW_MESSAGE
}

enum CpAuditSource {
  WEB
  MOBILE
  API
  SYSTEM
}
```

### 3.2 Core Hierarchy

```prisma
model CpOrganization {
  id            String       @id @default(uuid())
  creatorAuthId String                         // isce-auth user ID of the creator
  name          String
  slug          String       @unique
  status        CpOrgStatus  @default(ACTIVE)
  settings      Json?
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  deletedAt     DateTime?

  workspaces CpWorkspace[]

  @@index([creatorAuthId])
}

model CpWorkspace {
  id             String            @id @default(uuid())
  organizationId String
  organization   CpOrganization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name           String
  slug           String            @unique
  status         CpWorkspaceStatus @default(ACTIVE)
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt
  deletedAt      DateTime?

  companyProfile  CpCompanyProfile?
  members         CpWorkspaceMember[]
  leads           CpLead[]
  clients         CpClient[]
  appointments    CpAppointment[]
  attendance      CpAttendance[]
  conversations   CpConversation[]
  invoices        CpInvoice[]
  notifications   CpNotification[]
  auditLogs       CpAuditLog[]
  connectCards    CpConnectCard[]

  @@index([organizationId])
  @@index([slug])
}

model CpWorkspaceMember {
  id          String         @id @default(uuid())
  workspaceId String
  workspace   CpWorkspace    @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  authUserId  String                             // isce-auth user ID
  role        String                             // WORKSPACE_ADMIN | STAFF | CLIENT
  status      CpMemberStatus @default(ACTIVE)
  invitedBy   String?                            // authUserId of inviter
  joinedAt    DateTime?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  staffProfile CpStaffProfile?
  clientRecord CpClient?

  @@unique([workspaceId, authUserId])
  @@index([authUserId])
  @@index([workspaceId, role])
}
```

### 3.3 Company Profile (Workspace Identity)

```prisma
model CpCompanyProfile {
  id                  String      @id @default(uuid())
  workspaceId         String      @unique
  workspace           CpWorkspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  name                String
  logo                String?
  description         String?
  contactEmail        String?
  contactPhone        String?
  address             Json?
  businessHours       Json?       // [{ day: 0-6, open: "09:00", close: "17:00", isOpen: bool }]
  branding            Json?       // { primaryColor, font, ... }
  appointmentDefaults Json?
  invoiceDefaults     Json?       // { taxRate, currency, paymentTerms }
  notificationPrefs   Json?
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt
}
```

### 3.4 Staff & Connect Cards

```prisma
model CpStaffProfile {
  id          String            @id @default(uuid())
  workspaceId String
  memberId    String            @unique
  member      CpWorkspaceMember @relation(fields: [memberId], references: [id], onDelete: Cascade)
  authUserId  String
  name        String
  photo       String?
  jobTitle    String?
  department  String?
  staffNumber String?
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
  deletedAt   DateTime?

  connectCard  CpConnectCard?
  clients      CpClient[]        @relation("AssignedStaff")
  appointments CpAppointment[]
  attendance   CpAttendance[]
  invoices     CpInvoice[]

  @@index([workspaceId])
  @@index([authUserId])
}

model CpConnectCard {
  id          String      @id @default(uuid())
  workspaceId String
  workspace   CpWorkspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  staffId     String?     @unique
  staff       CpStaffProfile? @relation(fields: [staffId], references: [id], onDelete: SetNull)
  deviceId    String?     // Physical NFC device ID
  cardCode    String      @unique
  isActive    Boolean     @default(false)
  pairedAt    DateTime?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@index([workspaceId])
}
```

### 3.5 Lead & Client

```prisma
model CpLead {
  id               String        @id @default(uuid())
  workspaceId      String
  workspace        CpWorkspace   @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  name             String
  email            String?
  phone            String?
  source           CpLeadSource  @default(MANUAL)
  status           CpLeadStatus  @default(NEW)
  assignedStaffId  String?       // FK to CpStaffProfile
  notes            String?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  deletedAt        DateTime?

  appointments CpAppointment[]
  client       CpClient?

  @@index([workspaceId])
  @@index([status])
}

model CpClient {
  id              String            @id @default(uuid())
  workspaceId     String
  workspace       CpWorkspace       @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  memberId        String?           @unique // FK to CpWorkspaceMember (once they have a login)
  member          CpWorkspaceMember? @relation(fields: [memberId], references: [id], onDelete: SetNull)
  leadId          String?           @unique // Original lead record
  lead            CpLead?           @relation(fields: [leadId], references: [id], onDelete: SetNull)
  assignedStaffId String?
  assignedStaff   CpStaffProfile?   @relation("AssignedStaff", fields: [assignedStaffId], references: [id], onDelete: SetNull)
  authUserId      String?           // Set after isce-auth account is created
  name            String
  email           String?
  phone           String?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  deletedAt       DateTime?

  appointments CpAppointment[]
  invoices     CpInvoice[]
  conversations CpConversation[] @relation("ClientConversation")

  @@index([workspaceId])
  @@index([assignedStaffId])
  @@index([authUserId])
}
```

### 3.6 Appointments

```prisma
model CpAppointment {
  id          String              @id @default(uuid())
  workspaceId String
  workspace   CpWorkspace         @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  type        CpAppointmentType   @default(PUBLIC)
  leadId      String?
  lead        CpLead?             @relation(fields: [leadId], references: [id], onDelete: SetNull)
  clientId    String?
  client      CpClient?           @relation(fields: [clientId], references: [id], onDelete: SetNull)
  staffId     String?
  staff       CpStaffProfile?     @relation(fields: [staffId], references: [id], onDelete: SetNull)
  title       String
  reason      String?
  scheduledAt DateTime
  endsAt      DateTime?
  status      CpAppointmentStatus @default(PENDING)
  notes       String?
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt
  deletedAt   DateTime?

  @@index([workspaceId])
  @@index([staffId])
  @@index([scheduledAt])
}
```

### 3.7 Attendance

```prisma
model CpAttendance {
  id           String         @id @default(uuid())
  workspaceId  String
  workspace    CpWorkspace    @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  staffId      String
  staff        CpStaffProfile @relation(fields: [staffId], references: [id], onDelete: Cascade)
  checkIn      DateTime
  checkOut     DateTime?
  hoursWorked  Float?         // Calculated on check-out
  isLate       Boolean        @default(false)
  isOvertime   Boolean        @default(false)
  locationData Json?          // { lat, lng, accuracy }
  notes        String?
  overriddenBy String?        // Admin authUserId who overrode
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  @@index([workspaceId])
  @@index([staffId])
  @@index([checkIn])
}
```

### 3.8 Chat

```prisma
model CpConversation {
  id          String             @id @default(uuid())
  workspaceId String
  workspace   CpWorkspace        @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  type        CpConversationType
  name        String?            // For GROUP type
  clientId    String?            // For CLIENT_STAFF type
  client      CpClient?          @relation("ClientConversation", fields: [clientId], references: [id], onDelete: SetNull)
  lastMessageAt DateTime?
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt

  participants CpConversationParticipant[]
  messages     CpMessage[]

  @@index([workspaceId])
}

model CpConversationParticipant {
  id             String         @id @default(uuid())
  conversationId String
  conversation   CpConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  authUserId     String
  role           CpSenderRole
  joinedAt       DateTime       @default(now())
  leftAt         DateTime?

  @@unique([conversationId, authUserId])
  @@index([authUserId])
}

model CpMessage {
  id             String         @id @default(uuid())
  conversationId String
  conversation   CpConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  senderId       String         // authUserId
  senderRole     CpSenderRole
  content        String
  attachments    Json?          // [{ url, name, type, size }]
  readBy         Json?          // [{ userId, readAt }]
  isSystem       Boolean        @default(false)
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
  deletedAt      DateTime?

  @@index([conversationId])
  @@index([createdAt])
}
```

### 3.9 Invoices

```prisma
model CpInvoice {
  id              String          @id @default(uuid())
  workspaceId     String
  workspace       CpWorkspace     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  clientId        String
  client          CpClient        @relation(fields: [clientId], references: [id])
  createdByStaffId String?
  createdByStaff  CpStaffProfile? @relation(fields: [createdByStaffId], references: [id], onDelete: SetNull)
  invoiceNumber   String          @unique
  status          CpInvoiceStatus @default(DRAFT)
  dueDate         DateTime?
  notes           String?
  totalAmount     Decimal         @db.Decimal(18, 2)
  taxAmount       Decimal?        @db.Decimal(18, 2)
  discountAmount  Decimal?        @db.Decimal(18, 2)
  currency        String          @default("NGN")
  paidAt          DateTime?
  paidVia         String?         // "paystack" | "cash" | "bank_transfer"
  externalRef     String?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  items CpInvoiceItem[]

  @@index([workspaceId])
  @@index([clientId])
  @@index([status])
}

model CpInvoiceItem {
  id          String    @id @default(uuid())
  invoiceId   String
  invoice     CpInvoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  description String
  quantity    Float
  unitPrice   Decimal   @db.Decimal(18, 2)
  total       Decimal   @db.Decimal(18, 2)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

### 3.10 Notifications & Audit Logs

```prisma
model CpNotification {
  id              String             @id @default(uuid())
  workspaceId     String?
  workspace       CpWorkspace?       @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  organizationId  String?
  recipientAuthId String
  title           String
  message         String
  type            CpNotificationType
  isRead          Boolean            @default(false)
  metadata        Json?
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  @@index([recipientAuthId, isRead])
}

model CpAuditLog {
  id             String        @id @default(uuid())
  organizationId String?
  workspaceId    String?
  workspace      CpWorkspace?  @relation(fields: [workspaceId], references: [id], onDelete: SetNull)
  actorId        String        // authUserId, "system", or "external-auth"
  actorRole      String?
  eventType      String        // e.g. "INVOICE_CREATED", "LEAD_VALIDATED"
  targetEntity   String        // e.g. "Invoice", "Lead"
  targetEntityId String
  action         String        // e.g. "CREATE", "UPDATE", "DELETE"
  metadata       Json?
  ipAddress      String?
  userAgent      String?
  source         CpAuditSource @default(API)
  createdAt      DateTime      @default(now())  // Immutable — no updatedAt

  @@index([workspaceId])
  @@index([actorId])
  @@index([eventType])
  @@index([createdAt])
}
```

---

## 4. NestJS Module Structure

All modules live under `src/connect-plus/`.

```
src/connect-plus/
├── connect-plus.module.ts           # Root module — imports all CP sub-modules
├── guards/
│   ├── cp-context.guard.ts          # Resolves workspace context from JWT + header
│   └── cp-roles.guard.ts            # Enforces @CpRoles decorator
├── decorators/
│   ├── cp-roles.decorator.ts        # @CpRoles(CpRole.WORKSPACE_ADMIN, ...)
│   └── cp-context.decorator.ts      # @CpContext() param decorator
├── types/
│   └── cp-request.types.ts          # CpRequestContext interface
├── organizations/
│   ├── organizations.module.ts
│   ├── organizations.controller.ts
│   ├── organizations.service.ts
│   └── dto/
├── workspaces/
│   ├── workspaces.module.ts
│   ├── workspaces.controller.ts
│   ├── workspaces.service.ts
│   └── dto/
├── company-profile/
│   ├── company-profile.module.ts
│   ├── company-profile.controller.ts
│   ├── company-profile.service.ts
│   └── dto/
├── staff/
│   ├── staff.module.ts
│   ├── staff.controller.ts
│   ├── staff.service.ts
│   └── dto/
├── attendance/
│   ├── attendance.module.ts
│   ├── attendance.controller.ts
│   ├── attendance.service.ts
│   └── dto/
├── leads/
│   ├── leads.module.ts
│   ├── leads.controller.ts
│   ├── leads.service.ts
│   └── dto/
├── clients/
│   ├── clients.module.ts
│   ├── clients.controller.ts
│   ├── clients.service.ts
│   └── dto/
├── appointments/
│   ├── appointments.module.ts
│   ├── appointments.controller.ts
│   ├── appointments.service.ts
│   └── dto/
├── chat/
│   ├── chat.module.ts
│   ├── chat.controller.ts
│   ├── chat.service.ts
│   ├── chat.gateway.ts              # Socket.IO gateway
│   └── dto/
├── invoices/
│   ├── invoices.module.ts
│   ├── invoices.controller.ts
│   ├── invoices.service.ts
│   └── dto/
├── notifications/
│   ├── notifications.module.ts
│   ├── notifications.controller.ts
│   ├── notifications.service.ts
│   └── dto/
├── analytics/
│   ├── analytics.module.ts
│   ├── analytics.controller.ts
│   ├── analytics.service.ts
│   └── dto/
├── audit-logs/
│   ├── audit-logs.module.ts
│   ├── audit-logs.controller.ts
│   ├── audit-logs.service.ts
│   └── dto/
└── public/
    ├── public.module.ts             # @PublicRoute() card-tap endpoints
    ├── public.controller.ts
    └── public.service.ts
```

---

## 5. API Contract

### Auth header (all authenticated routes)
```
Authorization: Bearer <jwt>
x-workspace-id: <workspaceId>
```

---

### 5.1 Organizations `[/api/cp/organizations]`

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | CREATOR (auto-set on first create) | Create organization |
| GET | `/me` | CREATOR | Get my organization |
| PATCH | `/me` | CREATOR | Update org settings |
| DELETE | `/me` | CREATOR | Archive organization |

---

### 5.2 Workspaces `[/api/cp/workspaces]`

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | CREATOR | Create workspace |
| GET | `/` | CREATOR | List all org workspaces |
| GET | `/:id` | CREATOR, WORKSPACE_ADMIN | Get workspace detail |
| PATCH | `/:id` | CREATOR, WORKSPACE_ADMIN | Update workspace |
| PATCH | `/:id/status` | CREATOR | Activate / suspend / archive |
| POST | `/:id/invite-admin` | CREATOR | Invite a workspace admin |

---

### 5.3 Company Profile `[/api/cp/workspaces/:workspaceId/company-profile]`

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | WORKSPACE_ADMIN, STAFF | Get company profile |
| PUT | `/` | WORKSPACE_ADMIN | Upsert company profile |

---

### 5.4 Staff `[/api/cp/workspaces/:workspaceId/staff]`

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/invite` | WORKSPACE_ADMIN | Invite staff via email |
| GET | `/` | WORKSPACE_ADMIN | List all staff |
| GET | `/:staffId` | WORKSPACE_ADMIN, STAFF (self) | Get staff profile |
| PATCH | `/:staffId` | WORKSPACE_ADMIN | Update staff profile |
| PATCH | `/:staffId/status` | WORKSPACE_ADMIN | Suspend / remove staff |
| PATCH | `/:staffId/role` | WORKSPACE_ADMIN | Change role |
| POST | `/cards` | WORKSPACE_ADMIN | Create connect card |
| PATCH | `/cards/:cardId/pair` | WORKSPACE_ADMIN | Pair card to staff |
| PATCH | `/cards/:cardId/unpair` | WORKSPACE_ADMIN | Unpair card |

---

### 5.5 Attendance `[/api/cp/workspaces/:workspaceId/attendance]`

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/check-in` | STAFF | Record check-in |
| POST | `/check-out` | STAFF | Record check-out |
| GET | `/me` | STAFF | My attendance history |
| GET | `/` | WORKSPACE_ADMIN | All staff attendance |
| GET | `/:staffId` | WORKSPACE_ADMIN | One staff's attendance |
| PATCH | `/:recordId/override` | WORKSPACE_ADMIN | Override attendance record |

---

### 5.6 Leads `[/api/cp/workspaces/:workspaceId/leads]`

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | WORKSPACE_ADMIN, STAFF | List leads |
| GET | `/:leadId` | WORKSPACE_ADMIN, STAFF | Get lead detail |
| PATCH | `/:leadId/assign` | WORKSPACE_ADMIN | Assign lead to staff |
| PATCH | `/:leadId/validate` | STAFF, WORKSPACE_ADMIN | Convert lead → client |
| PATCH | `/:leadId/reject` | STAFF, WORKSPACE_ADMIN | Reject lead |
| DELETE | `/:leadId` | WORKSPACE_ADMIN | Delete lead |

---

### 5.7 Clients `[/api/cp/workspaces/:workspaceId/clients]`

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | WORKSPACE_ADMIN | List all clients |
| GET | `/assigned` | STAFF | My assigned clients |
| GET | `/:clientId` | WORKSPACE_ADMIN, STAFF (assigned) | Get client detail |
| PATCH | `/:clientId/assign` | WORKSPACE_ADMIN | Reassign client to staff |
| GET | `/me` | CLIENT | My client profile |

---

### 5.8 Appointments `[/api/cp/workspaces/:workspaceId/appointments]`

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | WORKSPACE_ADMIN | List all appointments |
| GET | `/assigned` | STAFF | My appointments |
| GET | `/:id` | WORKSPACE_ADMIN, STAFF | Get detail |
| POST | `/` | STAFF, WORKSPACE_ADMIN | Create appointment (client) |
| PATCH | `/:id/status` | STAFF, WORKSPACE_ADMIN | Update status |
| PATCH | `/:id` | STAFF (own), WORKSPACE_ADMIN | Update details |
| DELETE | `/:id` | WORKSPACE_ADMIN | Cancel appointment |
| GET | `/me` | CLIENT | My appointments |

---

### 5.9 Chat `[/api/cp/workspaces/:workspaceId/conversations]`

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | STAFF, CLIENT | List my conversations |
| GET | `/:id/messages` | STAFF, CLIENT | Get messages |
| POST | `/:id/messages` | STAFF, CLIENT | Send message |
| PATCH | `/:id/messages/read` | STAFF, CLIENT | Mark messages as read |
| POST | `/direct` | STAFF | Start a direct staff chat |

**WebSocket events:**
- `cp:join-workspace` — join workspace room
- `cp:message` — send message (payload: `{ conversationId, content, attachments? }`)
- `cp:message-received` — broadcast to conversation participants
- `cp:typing` — typing indicator

---

### 5.10 Invoices `[/api/cp/workspaces/:workspaceId/invoices]`

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | STAFF (assigned clients), WORKSPACE_ADMIN | Create invoice |
| GET | `/` | WORKSPACE_ADMIN | List all invoices |
| GET | `/assigned` | STAFF | Invoices for my clients |
| GET | `/:id` | WORKSPACE_ADMIN, STAFF (own), CLIENT (own) | Get invoice |
| PATCH | `/:id` | STAFF (draft, own), WORKSPACE_ADMIN | Update invoice |
| PATCH | `/:id/send` | STAFF (own), WORKSPACE_ADMIN | Send invoice to client |
| PATCH | `/:id/mark-paid` | WORKSPACE_ADMIN | Mark invoice as paid |
| PATCH | `/:id/cancel` | WORKSPACE_ADMIN | Cancel invoice |
| GET | `/:id/download` | WORKSPACE_ADMIN, CLIENT (own) | Download PDF |
| GET | `/me` | CLIENT | My invoices |

---

### 5.11 Notifications `[/api/cp/workspaces/:workspaceId/notifications]`

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | Any authenticated member | My notifications |
| PATCH | `/:id/read` | Any | Mark as read |
| PATCH | `/read-all` | Any | Mark all as read |

---

### 5.12 Analytics `[/api/cp/workspaces/:workspaceId/analytics]`

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/attendance` | WORKSPACE_ADMIN | Attendance summary |
| GET | `/clients` | WORKSPACE_ADMIN | Client engagement |
| GET | `/appointments` | WORKSPACE_ADMIN | Appointment volume |
| GET | `/invoices` | WORKSPACE_ADMIN | Revenue & invoice stats |
| GET | `/staff/:staffId` | WORKSPACE_ADMIN, STAFF (self) | Individual staff metrics |

**Organization-level (no workspaceId):**

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/cp/organizations/me/analytics` | CREATOR | Aggregated org analytics |

---

### 5.13 Audit Logs `[/api/cp/workspaces/:workspaceId/audit-logs]`

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | WORKSPACE_ADMIN | Workspace audit logs |
| GET | `/?entity=Invoice&entityId=xxx` | WORKSPACE_ADMIN | Filter by entity |

---

### 5.14 Public Routes (No Auth) `[/api/cp/public/:workspaceSlug]`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Get public company profile |
| POST | `/appointments` | Book appointment (lead) |
| POST | `/contacts/save` | Log contact-save event |
| POST | `/interactions` | Record card tap / QR scan |

---

## 6. RBAC Guard Implementation

### 6.1 CpContextGuard
Runs after the global `AuthGuard`. Applied to all routes under `/api/cp/` **except** `/api/cp/public/*`.

```typescript
// What it does:
// 1. Read workspaceId from request header x-workspace-id
// 2. Look up WorkspaceMember where authUserId = req.isce_auth.id AND workspaceId = workspaceId
// 3. If not found → 403 Forbidden
// 4. If member.status = SUSPENDED → 403
// 5. Attach to req.cp = { authUserId, workspaceId, organizationId, role, memberId }
```

For CREATOR routes (`/api/cp/organizations/*`), no `x-workspace-id` is needed — the guard looks up the organization by `creatorAuthId = req.isce_auth.id` instead.

### 6.2 @CpRoles Decorator + CpRolesGuard

```typescript
@CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.CREATOR)
@UseGuards(CpRolesGuard)
@Get('/')
async listStaff(@Req() req) { ... }
```

`CpRolesGuard` reads `req.cp.role` and compares against the allowed roles set by `@CpRoles`.

### 6.3 How CpContext is accessed in services

Pass `req.cp` into service methods:
```typescript
async listClients(ctx: CpRequestContext, query: ListClientsDto) {
  return this.db.cpClient.findMany({
    where: { workspaceId: ctx.workspaceId, ... }
  });
}
```

---

## 7. Key Business Logic Notes

### 7.1 Lead → Client Conversion
1. Staff calls `PATCH /leads/:id/validate`
2. Service creates `CpClient` record from lead data
3. Service calls `AUTH_API_URL/internal/invite` to trigger account creation in isce-auth (email invite to set password)
4. `CpWorkspaceMember` row is created with `role=CLIENT`, `status=ACTIVE` (pre-set; activated when user completes auth signup)
5. `CpLead.status` updated to `CONVERTED`
6. Notification sent to staff + workspace admin
7. Audit log written

### 7.2 Invoice Immutability
- Once `status = PAID`, no fields are editable — the API returns 403 on any PATCH
- `CpAuditLog` entry is mandatory on every status change

### 7.3 Group Chat Auto-Creation
- When a Workspace is created, a `CpConversation` of type `WORKSPACE_GROUP` is automatically created
- All staff added to workspace are automatically added as participants

### 7.4 CLIENT_STAFF Conversation
- Created when a lead is validated → client. One conversation per client, always between the client and their assigned staff
- If assigned staff changes, the new staff is added to the conversation (old staff remains for history)

### 7.5 Attendance — Auto Check-Out
- A cron job runs at midnight and auto-checks-out any staff still checked in
- `isOvertime` is set if `hoursWorked > workspaceDefault` (from `CompanyProfile.invoiceDefaults`)

### 7.6 Audit Logs — Write-Once
- `CpAuditLog` table has no `updatedAt` field
- No DELETE or PATCH endpoints exist for audit logs
- The service writes audit entries in a fire-and-forget pattern (non-blocking)

---

## 8. Non-Functional Requirements

| Concern | Approach |
|---------|---------|
| Multi-tenancy | All queries include `workspaceId` filter, enforced via `CpContextGuard` |
| Security | Helmet + ValidationPipe (global). CpContextGuard on all CP routes. |
| Real-time | Socket.IO rooms named `workspace:{workspaceId}` for chat and notifications |
| Rate limiting | Inherited global ThrottlerGuard (30/60s) |
| Audit trail | Every mutating operation calls `CpAuditLogService.write(...)` |
| Scalability | No in-memory state — all context resolved from DB per request |
| Soft deletes | `deletedAt` on all mutable entities; all queries filter `deletedAt: null` |