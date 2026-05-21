



CONNECT PLUS
Unified Developer PRD
v2.0 — Compiled & Reviewed Against Engineering Best Practices


Source Documents:
CONNECT PLUS — Product Requirements Document  (v1.0)
CONNECT PLUS — Developer PRD  (Engineering Spec)
Platform:  ISCE Connect (connect-nest)  ·  NestJS 11  ·  TypeScript  ·  Prisma  ·  PostgreSQL (Neon)
Date:  May 2026  ·  Version 2.0 (Final)
 
1. Architecture Overview
1.1  Repository & Module Location
Connect Plus is built as new modules inside the existing connect-nest repository on branch cplus. All modules live under src/connect-plus/ and share the existing NestJS infrastructure — DatabaseService (PrismaService), global AuthGuard, global ValidationPipe, ThrottlerGuard, and Helmet configuration. No separate application or microservice.

1.2  URL Namespace
All Connect Plus routes are prefixed /api/cp/ to avoid collisions with existing connect-nest routes (which use /api/).

1.3  Auth & Workspace Context
isce-auth issues JWTs with the following confirmed payload:
{ id, email, phone, firstName, lastName, displayPicture, userType }

Connect Plus does not modify isce-auth. Instead, workspace context is resolved via a two-layer guard pattern on every authenticated request:
1.	The existing global AuthGuard validates the JWT and makes req.isce_auth available.
2.	A new CpContextGuard reads the x-workspace-id header, queries WorkspaceMember, and attaches req.cp.

The resolved request.cp object:
request.cp = {
  authUserId:     string,   // from JWT id
  workspaceId:    string,   // from x-workspace-id header
  organizationId: string,   // resolved from workspace.organizationId
  role:           CpRole,   // resolved from CpWorkspaceMember.role
  memberId:       string,   // CpWorkspaceMember.id
}

For Creator routes (/api/cp/organizations/*), no x-workspace-id header is required. The guard resolves the organization by CpOrganization.creatorAuthId = req.isce_auth.id.
For public endpoints (/api/cp/public/*), no JWT is required. These use the existing @PublicRoute() decorator.

1.4  Database
Same Neon PostgreSQL instance. All Connect Plus models are added to prisma/schema.prisma. Every model is prefixed Cp to prevent naming collisions with existing models and future additions.

1.5  Real-Time Chat
Uses Socket.IO (already installed for artisan threads). A new CpChatGateway is added with workspace-scoped rooms named workspace:{workspaceId}. The existing socket gateway is not modified.

1.6  File Storage
Re-uses existing DigitalOcean Spaces infrastructure already in place for FileItem uploads. Invoice PDFs, workspace logos, and message attachments use the same upload service.

 
2. Role Model
enum CpRole {
  CREATOR          // Organization owner — cross-workspace visibility, analytics only
  WORKSPACE_ADMIN  // Full control within one workspace
  STAFF            // Operates within own assigned clients
  CLIENT           // Validated user — limited to own data
  VISITOR          // Unauthenticated — public routes only
}

Scope hierarchy:
Platform
└── Organization  (CREATOR owns)
    └── Workspace (WORKSPACE_ADMIN manages)
        ├── Staff    (STAFF role — CpWorkspaceMember + CpStaffProfile)
        └── Clients  (CLIENT role — CpWorkspaceMember + CpClient)

Role	Scope	Key Constraints
VISITOR	Public (unauthenticated)	Can only access /api/cp/public/* routes. No JWT required.
CLIENT	Own data only	Can view own appointments and invoices. Cannot see workspace structure.
STAFF	Assigned clients only	Manages assigned clients/leads. Creates invoices for own clients only. Cannot access other staff's data.
WORKSPACE_ADMIN	Full workspace	All staff, all clients, all invoices, all attendance. Can override attendance, pair cards, export.
CREATOR	Organization-wide (agg)	Manages workspace structure. Sees analytics only — no client PII, no individual invoices.

 
3. Prisma Schema — Final Corrected Version
⚠  This section contains the authoritative final schema. Corrections to the source Developer PRD are annotated with // FIXED: comments. All corrections are justified in Section 10.

3.1  Enums
enum CpOrgStatus       { ACTIVE  SUSPENDED  ARCHIVED }
enum CpWorkspaceStatus { ACTIVE  SUSPENDED  ARCHIVED }
enum CpMemberStatus    { ACTIVE  SUSPENDED  REMOVED }

// FIXED: CpRole used as a proper enum (Developer PRD had role as String on CpWorkspaceMember)
enum CpRole {
  CREATOR  WORKSPACE_ADMIN  STAFF  CLIENT  VISITOR
}

enum CpLeadSource  { CARD_TAP  QR_SCAN  MANUAL  FORM_SUBMIT }
enum CpLeadStatus  { NEW  CONTACTED  VALIDATED  REJECTED  CONVERTED }

enum CpAppointmentType   { PUBLIC  CLIENT }
enum CpAppointmentStatus { PENDING  CONFIRMED  RESCHEDULED  COMPLETED  CANCELLED  NO_SHOW }

enum CpConversationType  { WORKSPACE_GROUP  DIRECT  CLIENT_STAFF }
enum CpSenderRole        { STAFF  CLIENT  SYSTEM }
// FIXED: separate enum for participant role — CpSenderRole.SYSTEM is not valid as a participant
enum CpParticipantRole   { MEMBER  ADMIN }

enum CpInvoiceStatus { DRAFT  SENT  PAID  OVERDUE  CANCELLED }

// FIXED: CpCardStatus enum replaces isActive Boolean — 4 distinct states required
enum CpCardStatus { UNASSIGNED  ACTIVE  SUSPENDED  LOST }

enum CpNotificationType {
  APPOINTMENT_BOOKED     APPOINTMENT_CONFIRMED  APPOINTMENT_RESCHEDULED  APPOINTMENT_CANCELLED
  LEAD_ASSIGNED          LEAD_VALIDATED
  CLIENT_INVITED         CLIENT_MESSAGE
  INVOICE_ISSUED         INVOICE_OVERDUE        INVOICE_PAID            INVOICE_CANCELLED
  ATTENDANCE_LATE        ATTENDANCE_OVERRIDE
  WORKSPACE_INVITE_SENT  WORKSPACE_INVITE_ACCEPTED
  STAFF_SUSPENDED        STAFF_REMOVED
  WORKSPACE_CREATED      WORKSPACE_SUSPENDED
  ORG_ALERT              NEW_MESSAGE
}

enum CpAuditSource { WEB  MOBILE  API  SYSTEM }

3.2  Core Hierarchy
model CpOrganization {
  id            String        @id @default(uuid())
  creatorAuthId String                          // isce-auth user id of the Creator
  name          String
  slug          String        @unique
  status        CpOrgStatus   @default(ACTIVE)
  settings      Json?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  deletedAt     DateTime?

  workspaces CpWorkspace[]
  auditLogs  CpAuditLog[]

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

  companyProfile CpCompanyProfile?
  members        CpWorkspaceMember[]
  leads          CpLead[]
  clients        CpClient[]
  appointments   CpAppointment[]
  attendance     CpAttendance[]
  conversations  CpConversation[]
  invoices       CpInvoice[]
  notifications  CpNotification[]
  auditLogs      CpAuditLog[]
  connectCards   CpConnectCard[]
  invites        CpWorkspaceInvite[]

  @@index([organizationId])
  @@index([slug])
}

model CpWorkspaceMember {
  id          String         @id @default(uuid())
  workspaceId String
  workspace   CpWorkspace    @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  authUserId  String                              // isce-auth user id
  role        CpRole                              // FIXED: enum, not String
  status      CpMemberStatus @default(ACTIVE)
  invitedBy   String?                             // authUserId of inviter
  joinedAt    DateTime?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  staffProfile  CpStaffProfile?
  clientRecord  CpClient?
  invitesSent   CpWorkspaceInvite[]

  @@unique([workspaceId, authUserId])
  @@index([authUserId])
  @@index([workspaceId, role])
}

3.3  Company Profile (Workspace Identity)
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
  businessHours       Json?       // [{ day:0-6, open:'09:00', close:'17:00', isOpen:bool }]
  branding            Json?       // { primaryColor, accentColor, font }
  appointmentDefaults Json?       // { defaultDuration, bufferMins, reminderHours }
  invoiceDefaults     Json?       // { taxRate, currency, paymentTermsDays }
  notificationPrefs   Json?
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt
}

3.4  Workspace Invite
NOTE: CpWorkspaceInvite was absent from the Developer PRD. It is required — invite tokens must be persisted to enable validation, expiry enforcement, and revocation. This is a security gap if omitted.

model CpWorkspaceInvite {
  id          String         @id @default(uuid())
  workspaceId String
  workspace   CpWorkspace    @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  email       String
  role        CpRole                           // STAFF or WORKSPACE_ADMIN
  token       String         @unique           // Secure token sent to isce-auth for dispatch
  status      String         @default("PENDING") // PENDING | ACCEPTED | DECLINED | EXPIRED
  invitedById String
  invitedBy   CpWorkspaceMember @relation(fields: [invitedById], references: [id])
  expiresAt   DateTime                         // Default: now() + 7 days
  acceptedAt  DateTime?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  @@index([workspaceId])
  @@index([email])
  @@index([token])
}

3.5  Staff & Connect Cards
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
  id          String         @id @default(uuid())
  workspaceId String
  workspace   CpWorkspace    @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  staffId     String?        @unique
  staff       CpStaffProfile? @relation(fields: [staffId], references: [id], onDelete: SetNull)
  deviceId    String?                          // Physical NFC DeviceProfile.deviceId
  cardCode    String         @unique
  // FIXED: status enum replaces isActive Boolean — UNASSIGNED/ACTIVE/SUSPENDED/LOST
  status      CpCardStatus   @default(UNASSIGNED)
  tapConfig   Json?                            // { enabledActions, theme }
  pairedBy    String?                          // authUserId of admin who paired
  pairedAt    DateTime?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  @@index([workspaceId])
}

3.6  Lead & Client
model CpLead {
  id              String       @id @default(uuid())
  workspaceId     String
  workspace       CpWorkspace  @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  name            String
  email           String?
  phone           String?
  source          CpLeadSource @default(MANUAL)
  status          CpLeadStatus @default(NEW)
  assignedStaffId String?
  notes           String?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  deletedAt       DateTime?

  appointments CpAppointment[]
  client       CpClient?

  @@index([workspaceId])
  @@index([status])
}

model CpClient {
  id              String            @id @default(uuid())
  workspaceId     String
  workspace       CpWorkspace       @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  memberId        String?           @unique  // FK → CpWorkspaceMember once account exists
  member          CpWorkspaceMember? @relation(fields: [memberId], references: [id], onDelete: SetNull)
  leadId          String?           @unique  // Source lead record
  lead            CpLead?           @relation(fields: [leadId], references: [id], onDelete: SetNull)
  assignedStaffId String?
  assignedStaff   CpStaffProfile?   @relation("AssignedStaff", fields: [assignedStaffId], references: [id], onDelete: SetNull)
  authUserId      String?                    // Set after isce-auth account creation
  name            String
  email           String?
  phone           String?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  deletedAt       DateTime?

  appointments  CpAppointment[]
  invoices      CpInvoice[]
  conversations CpConversation[] @relation("ClientConversation")

  @@index([workspaceId])
  @@index([assignedStaffId])
  @@index([authUserId])
}

3.7  Appointments
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
  reminderSentAt DateTime?
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt
  deletedAt   DateTime?

  @@index([workspaceId])
  @@index([staffId])
  @@index([scheduledAt])
}

3.8  Attendance
NOTE: Two corrections applied — (1) date field added and normalized to midnight UTC to enforce unique-per-day constraint; (2) hoursWorked changed from Float to Decimal to avoid floating-point rounding in payroll calculations.

model CpAttendance {
  id          String         @id @default(uuid())
  workspaceId String
  workspace   CpWorkspace    @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  staffId     String
  staff       CpStaffProfile @relation(fields: [staffId], references: [id], onDelete: Cascade)
  // FIXED: date field added — normalized to midnight UTC for unique-per-day enforcement
  date        DateTime                         // midnight UTC (set in application layer)
  checkIn     DateTime
  checkOut    DateTime?
  // FIXED: Decimal replaces Float — float rounding causes errors in payroll/hour calculations
  hoursWorked Decimal?       @db.Decimal(5, 2)
  isLate      Boolean        @default(false)
  isOvertime  Boolean        @default(false)
  locationData Json?         // { lat, lng, accuracy }
  notes       String?
  overriddenBy String?       // authUserId of admin who overrode
  overriddenAt DateTime?
  overrideReason String?
  autoCheckedOut Boolean     @default(false)
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  // FIXED: unique constraint added — prevents duplicate records for same staff/day
  @@unique([staffId, date])
  @@index([workspaceId])
  @@index([staffId])
  @@index([checkIn])
}

3.9  Chat
NOTE: readBy Json? removed from CpMessage. Read tracking is now handled via CpConversationParticipant.lastReadAt (cursor approach). Storing read receipts as a growing JSON array on every message row is an O(n) antipattern at scale.

model CpConversation {
  id            String             @id @default(uuid())
  workspaceId   String
  workspace     CpWorkspace        @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  type          CpConversationType
  name          String?            // GROUP chats only
  clientId      String?
  client        CpClient?          @relation("ClientConversation", fields: [clientId], references: [id], onDelete: SetNull)
  isAutoCreated Boolean            @default(false)
  lastMessageAt DateTime?
  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt
  deletedAt     DateTime?

  participants  CpConversationParticipant[]
  messages      CpMessage[]

  @@index([workspaceId])
}

model CpConversationParticipant {
  id             String             @id @default(uuid())
  conversationId String
  conversation   CpConversation     @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  authUserId     String
  // FIXED: CpParticipantRole replaces CpSenderRole — SYSTEM is not a valid participant
  role           CpParticipantRole  @default(MEMBER)
  joinedAt       DateTime           @default(now())
  leftAt         DateTime?
  lastReadAt     DateTime?          // Cursor for unread count — replaces readBy Json[]

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
  // REMOVED: readBy Json? — use lastReadAt cursor on CpConversationParticipant instead
  isSystem       Boolean        @default(false)
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
  deletedAt      DateTime?

  @@index([conversationId])
  @@index([createdAt])
}

3.10  Invoices
NOTE: Two corrections — (1) all Decimal fields changed from (18,2) to (18,4) for financial precision; (2) quantity changed from Float to Decimal to prevent floating-point rounding in line-item totals.

model CpInvoice {
  id               String          @id @default(uuid())
  workspaceId      String
  workspace        CpWorkspace     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  clientId         String
  client           CpClient        @relation(fields: [clientId], references: [id], onDelete: Restrict)
  createdByStaffId String?
  createdByStaff   CpStaffProfile? @relation(fields: [createdByStaffId], references: [id], onDelete: SetNull)
  invoiceNumber    String          @unique
  status           CpInvoiceStatus @default(DRAFT)
  dueDate          DateTime?
  notes            String?
  // FIXED: Decimal(18,4) throughout — sufficient precision for tax on fractional amounts
  totalAmount      Decimal         @db.Decimal(18, 4)
  taxAmount        Decimal?        @db.Decimal(18, 4)
  discountAmount   Decimal?        @db.Decimal(18, 4)
  currency         String          @default("NGN")
  sentAt           DateTime?
  paidAt           DateTime?
  overdueAt        DateTime?
  paidVia          String?         // paystack | cash | bank_transfer
  externalRef      String?
  pdfUrl           String?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt
  deletedAt        DateTime?       // Must never be set when status = PAID

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
  // FIXED: Decimal replaces Float — float rounding corrupts invoice line totals
  quantity    Decimal   @db.Decimal(10, 2)
  unitPrice   Decimal   @db.Decimal(18, 4)
  total       Decimal   @db.Decimal(18, 4)
  order       Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

3.11  Notifications
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

3.12  Audit Log
NOTE: before and after JSON fields added for state snapshots. An audit log without before/after state only records that an event happened — not how data changed. Required for compliance and dispute resolution.

NOTE: actorId changed to nullable (String?) to cleanly represent system-generated events without relying on magic strings ('system', 'external-auth'). isSystemEvent Boolean added for explicit filtering.

model CpAuditLog {
  id             String        @id @default(uuid())
  organizationId String?
  workspaceId    String?
  workspace      CpWorkspace?  @relation(fields: [workspaceId], references: [id], onDelete: SetNull)
  organization   CpOrganization? @relation(fields: [organizationId], references: [id], onDelete: SetNull)
  // FIXED: nullable — null for system events (avoid magic strings 'system'/'external-auth')
  actorId        String?       // authUserId; null for system-generated events
  actorRole      String?
  isSystemEvent  Boolean       @default(false)    // ADDED: explicit flag for system events
  eventType      String        // e.g. INVOICE_CREATED, LEAD_VALIDATED
  targetEntity   String        // e.g. Invoice, Lead, CpWorkspaceMember
  targetEntityId String
  action         String        // CREATE | UPDATE | DELETE | SEND | VALIDATE | etc.
  // ADDED: state snapshots — required for meaningful compliance audit
  before         Json?         // State before the change (UPDATE events)
  after          Json?         // State after the change
  metadata       Json?
  ipAddress      String?
  userAgent      String?
  source         CpAuditSource @default(API)
  success        Boolean       @default(true)
  errorMessage   String?
  createdAt      DateTime      @default(now()) // Immutable — no updatedAt, no deletedAt

  @@index([workspaceId])
  @@index([actorId])
  @@index([eventType])
  @@index([createdAt])
}

 
4. NestJS Module Structure
All modules live under src/connect-plus/. The root module ConnectPlusModule is imported into AppModule.

src/connect-plus/
├── connect-plus.module.ts
├── guards/
│   ├── cp-context.guard.ts       # Resolves workspace context from JWT + x-workspace-id header
│   └── cp-roles.guard.ts         # Enforces @CpRoles() decorator
├── decorators/
│   ├── cp-roles.decorator.ts     # @CpRoles(CpRole.WORKSPACE_ADMIN, ...)
│   └── cp-context.decorator.ts   # @CpContext() param decorator
├── types/
│   └── cp-request.types.ts       # CpRequestContext interface
├── organizations/
│   └── {module, controller, service, dto/}
├── workspaces/
│   └── {module, controller, service, dto/}
├── company-profile/
│   └── {module, controller, service, dto/}
├── staff/
│   └── {module, controller, service, dto/}
├── invites/
│   └── {module, controller, service, dto/}    # ADDED: manages CpWorkspaceInvite
├── attendance/
│   └── {module, controller, service, dto/}
├── leads/
│   └── {module, controller, service, dto/}
├── clients/
│   └── {module, controller, service, dto/}
├── appointments/
│   └── {module, controller, service, dto/}
├── chat/
│   └── {module, controller, service, chat.gateway.ts, dto/}
├── invoices/
│   └── {module, controller, service, dto/}
├── notifications/
│   └── {module, controller, service, dto/}
├── analytics/
│   └── {module, controller, service, dto/}
├── audit-logs/
│   └── {module, controller, service, dto/}
└── public/
    └── {module, controller, service}           # @PublicRoute() card-tap, booking endpoints

 
5. API Contract
Auth headers on all authenticated routes:
Authorization: Bearer <jwt>
x-workspace-id: <workspaceId>

5.1  Organizations  /api/cp/organizations
Method	Path	Role	Description
POST	/	CREATOR (auto-set)	Create organization
GET	/me	CREATOR	Get my organization
PATCH	/me	CREATOR	Update org settings
DELETE	/me	CREATOR	Archive organization
GET	/me/analytics	CREATOR	Aggregated org analytics (no workspace PII)

5.2  Workspaces  /api/cp/workspaces
Method	Path	Role	Description
POST	/	CREATOR	Create workspace
GET	/	CREATOR	List all org workspaces
GET	/:id	CREATOR, WORKSPACE_ADMIN	Get workspace detail
PATCH	/:id	CREATOR, WORKSPACE_ADMIN	Update workspace
PATCH	/:id/status	CREATOR	Activate / suspend / archive
POST	/:id/invite-admin	CREATOR	Invite a workspace admin

5.3  Company Profile  /api/cp/workspaces/:wsId/company-profile
Method	Path	Role	Description
GET	/	WORKSPACE_ADMIN, STAFF	Get company profile
PUT	/	WORKSPACE_ADMIN	Upsert company profile

5.4  Staff  /api/cp/workspaces/:wsId/staff
Method	Path	Role	Description
POST	/invite	WORKSPACE_ADMIN	Invite staff by email — creates CpWorkspaceInvite + calls isce-auth
GET	/invites	WORKSPACE_ADMIN	List pending invites
GET	/	WORKSPACE_ADMIN	List all staff
GET	/:staffId	WORKSPACE_ADMIN, STAFF(self)	Get staff profile
PATCH	/:staffId	WORKSPACE_ADMIN	Update staff profile
PATCH	/:staffId/status	WORKSPACE_ADMIN	Suspend or remove staff
PATCH	/:staffId/role	WORKSPACE_ADMIN	Promote / demote role
POST	/cards	WORKSPACE_ADMIN	Add card to inventory
PATCH	/cards/:cardId/pair	WORKSPACE_ADMIN	Pair card to staff member
PATCH	/cards/:cardId/config	WORKSPACE_ADMIN	Set tap page config
PATCH	/cards/:cardId/status	WORKSPACE_ADMIN	ACTIVE / SUSPENDED / LOST

5.5  Attendance  /api/cp/workspaces/:wsId/attendance
Method	Path	Role	Description
POST	/check-in	STAFF	Record check-in — creates CpAttendance record
POST	/check-out	STAFF	Record check-out — calculates hoursWorked
GET	/me	STAFF	My attendance history (date range filter)
GET	/	WORKSPACE_ADMIN	All staff attendance (filter: staffId, date, flags)
GET	/:staffId	WORKSPACE_ADMIN	One staff member's attendance
PATCH	/:recordId/override	WORKSPACE_ADMIN	Override record — sets overriddenBy, logs to audit

5.6  Leads  /api/cp/workspaces/:wsId/leads
Method	Path	Role	Description
GET	/	WORKSPACE_ADMIN, STAFF	List leads (STAFF sees all, but notes own assignment)
GET	/:leadId	WORKSPACE_ADMIN, STAFF	Get lead detail
PATCH	/:leadId/assign	WORKSPACE_ADMIN	Assign lead to staff member
PATCH	/:leadId/validate	STAFF, WORKSPACE_ADMIN	Convert lead → client (creates CpClient, calls isce-auth)
PATCH	/:leadId/reject	STAFF, WORKSPACE_ADMIN	Reject lead
DELETE	/:leadId	WORKSPACE_ADMIN	Soft-delete lead

5.7  Clients  /api/cp/workspaces/:wsId/clients
Method	Path	Role	Description
GET	/	WORKSPACE_ADMIN	List all clients
GET	/assigned	STAFF	My assigned clients
GET	/:clientId	WORKSPACE_ADMIN, STAFF(assigned)	Get client detail
PATCH	/:clientId/assign	WORKSPACE_ADMIN	Reassign client to different staff
GET	/me	CLIENT	My own client profile

5.8  Appointments  /api/cp/workspaces/:wsId/appointments
Method	Path	Role	Description
GET	/	WORKSPACE_ADMIN	List all appointments
GET	/assigned	STAFF	My appointments (assigned staffId)
GET	/:id	WORKSPACE_ADMIN, STAFF	Get detail
POST	/	STAFF, WORKSPACE_ADMIN	Create appointment (CLIENT type)
PATCH	/:id/status	STAFF, WORKSPACE_ADMIN	Update status
PATCH	/:id	STAFF(own), WORKSPACE_ADMIN	Update details
DELETE	/:id	WORKSPACE_ADMIN	Cancel appointment
GET	/me	CLIENT	My appointments

5.9  Chat  /api/cp/workspaces/:wsId/conversations
Method	Path	Role	Description
GET	/	STAFF, CLIENT	List my conversations
POST	/direct	STAFF	Start a direct staff-to-staff chat
GET	/:id/messages	STAFF, CLIENT	Get messages (cursor pagination)
POST	/:id/messages	STAFF, CLIENT	Send message
PATCH	/:id/messages/read	STAFF, CLIENT	Mark read — updates lastReadAt on participant

WebSocket events (/api/cp namespace):
Event	Direction	Payload
cp:join-workspace	Client → Server	{ workspaceId }
cp:message	Client → Server	{ conversationId, content, attachments? }
cp:message-received	Server → Clients	{ message, conversationId }
cp:typing	Client → Server	{ conversationId }
cp:notification	Server → Client	{ type, title, message, entityId? }

5.10  Invoices  /api/cp/workspaces/:wsId/invoices
Method	Path	Role	Description
POST	/	STAFF(assigned), WORKSPACE_ADMIN	Create invoice — validates client is assigned to staff
GET	/	WORKSPACE_ADMIN	List all invoices
GET	/assigned	STAFF	Invoices for my clients
GET	/:id	WORKSPACE_ADMIN, STAFF(own), CLIENT(own)	Get invoice
PATCH	/:id	STAFF(draft+own), WORKSPACE_ADMIN	Update — DRAFT only; 403 if PAID
PATCH	/:id/send	STAFF(own), WORKSPACE_ADMIN	Send invoice to client
PATCH	/:id/mark-paid	WORKSPACE_ADMIN	Mark paid — record becomes immutable
PATCH	/:id/cancel	WORKSPACE_ADMIN	Cancel invoice
GET	/:id/download	WORKSPACE_ADMIN, CLIENT(own)	Download PDF
GET	/me	CLIENT	My invoices

5.11  Notifications, Analytics, Audit  /api/cp/workspaces/:wsId/...
Module	Endpoint	Role	Description
Notifications	GET /notifications	Any member	My unread / all notifications
Notifications	PATCH /notifications/:id/read	Any member	Mark as read
Notifications	PATCH /notifications/read-all	Any member	Mark all as read
Analytics	GET /analytics/attendance	WORKSPACE_ADMIN	Attendance summary
Analytics	GET /analytics/clients	WORKSPACE_ADMIN	Client engagement metrics
Analytics	GET /analytics/invoices	WORKSPACE_ADMIN	Revenue and invoice stats
Analytics	GET /analytics/staff/:staffId	WORKSPACE_ADMIN, STAFF(self)	Individual staff metrics
Audit	GET /audit-logs	WORKSPACE_ADMIN	Workspace audit logs
Audit	GET /audit-logs?entity=Invoice&entityId=x	WORKSPACE_ADMIN	Filter by entity

5.12  Public Routes (No Auth)  /api/cp/public/:workspaceSlug
Method	Path	Description
GET	/	Get public company profile (name, logo, description, hours, contact)
POST	/appointments	Book appointment — creates CpLead (new email) + CpAppointment (PUBLIC type)
POST	/contacts/save	Log contact-save event — creates CpLead with source FORM_SUBMIT
POST	/interactions	Record card tap or QR scan — creates CardInteraction with workspace context

 
6. RBAC Guard Implementation
6.1  CpContextGuard
Applied to all routes under /api/cp/ except /api/cp/public/*. Runs after the global AuthGuard.

// cp-context.guard.ts — pseudo-implementation
@Injectable()
export class CpContextGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authUserId = req.isce_auth.id;  // from global AuthGuard

    // Creator routes — no workspace header needed
    if (isCreatorRoute(req)) {
      const org = await this.db.cpOrganization.findFirst(
        { where: { creatorAuthId: authUserId } }
      );
      if (!org) throw new ForbiddenException();
      req.cp = { authUserId, organizationId: org.id, role: CpRole.CREATOR };
      return true;
    }

    const workspaceId = req.headers['x-workspace-id'];
    if (!workspaceId) throw new BadRequestException('x-workspace-id header required');

    const member = await this.db.cpWorkspaceMember.findUnique({
      where: { workspaceId_authUserId: { workspaceId, authUserId } },
      include: { workspace: { select: { organizationId: true } } },
    });

    if (!member)                         throw new ForbiddenException();
    if (member.status === 'SUSPENDED')   throw new ForbiddenException('Account suspended');
    if (member.status === 'REMOVED')     throw new ForbiddenException('Access revoked');

    req.cp = {
      authUserId,
      workspaceId,
      organizationId: member.workspace.organizationId,
      role:           member.role as CpRole,
      memberId:       member.id,
    };
    return true;
  }
}

6.2  CpRoles Decorator + Guard
// Usage on a controller method
@CpRoles(CpRole.WORKSPACE_ADMIN, CpRole.CREATOR)
@UseGuards(CpRolesGuard)
@Get('/')
async listStaff(@Req() req) {
  return this.staffService.findAll(req.cp, query);
}

// In services — always pass ctx, never extract from DB again
async listClients(ctx: CpRequestContext, query: ListClientsDto) {
  const whereClause = ctx.role === CpRole.STAFF
    ? { workspaceId: ctx.workspaceId, assignedStaffId: ctx.memberId }  // staff sees own
    : { workspaceId: ctx.workspaceId };                                // admin sees all
  return this.db.cpClient.findMany({ where: whereClause });
}

 
7. Key Business Logic
7.1  Lead → Client Conversion
3.	Staff calls PATCH /leads/:id/validate with role STAFF or WORKSPACE_ADMIN.
4.	Service creates CpClient from lead data (name, email, phone).
5.	Service calls AUTH_API_URL/internal/invite to trigger password-set email in isce-auth.
6.	CpWorkspaceMember row is created with role = CLIENT, status = ACTIVE (pre-set for when user completes signup).
7.	CpLead.status updated to CONVERTED.
8.	CpConversation (CLIENT_STAFF type) auto-created between client and assignedStaff.
9.	CpAuditLog entry written synchronously (before/after state captured).
10.	CpNotification emitted to assigned staff and workspace admin.

7.2  Invoice Immutability
•	Once status = PAID, the service throws ForbiddenException on any PATCH request — for any role including WORKSPACE_ADMIN.
•	The guard check is in the service layer (not just the controller) to protect against programmatic calls.
•	CpAuditLog entry is mandatory on every status change. The before/after fields capture the full invoice state snapshot.

7.3  Group Chat Auto-Creation
•	When a CpWorkspace is created, a CpConversation of type WORKSPACE_GROUP is auto-created (isAutoCreated = true).
•	All new staff members are automatically added as CpConversationParticipants when they join (joinedAt set).
•	The workspace group conversation is never deleted — it persists even if all staff are removed.

7.4  CLIENT_STAFF Conversation
•	Auto-created when a lead is validated to a client. One conversation per client, between the client and their assignedStaff.
•	If the assigned staff changes, the new staff is added as a participant. Old staff remains (history preserved).

7.5  Attendance Auto Check-Out
•	A CRON job runs at midnight (or workspace businessHours end) and auto-checks-out any staff still checked in.
•	Guard: only fires if checkIn is set AND checkOut is null AND date = today. Fully idempotent.
•	Sets autoCheckedOut = true. CpAuditLog entry written.
•	isOvertime is set when hoursWorked > invoiceDefaults.standardHours from CpCompanyProfile.

7.6  Audit Logs — Write-Once
•	CpAuditLog has no updatedAt field. No PATCH or DELETE endpoint exists for any role.
•	Audit entries are written in a non-blocking fire-and-forget pattern (EventEmitter or background queue).
•	before and after fields are captured before and after the DB transaction, not from the request payload.
•	success = false entries are also persisted for security monitoring (RBAC violations, failed login attempts).

 
8. Non-Functional Requirements
Concern	Approach
Multi-tenancy	All queries include workspaceId filter. Enforced at service layer via ctx.workspaceId from CpContextGuard. Cross-workspace access throws ForbiddenException.
Security	Helmet + ValidationPipe (global, inherited). CpContextGuard on all /api/cp/ routes. Paid invoice immutability at service layer. CpWorkspaceInvite tokens are hashed before storage.
Real-time	Socket.IO rooms named workspace:{workspaceId}. CpChatGateway in dedicated /cp namespace. No interference with existing artisan socket gateway.
Rate limiting	Inherited global ThrottlerGuard (30 requests / 60s). Stricter limits applied to public booking and card-tap endpoints via @Throttle() override.
Audit trail	Every mutating service method calls cpAuditLogService.write(ctx, ...) with before/after snapshots. Non-blocking. Immutable records only.
Scalability	No in-memory state. All context resolved from DB per request. Analytics endpoints use async Bull jobs with Redis caching. Chat read status uses lastReadAt cursor (not per-message JSON).
Soft deletes	deletedAt on all mutable entities. All queries include WHERE deletedAt IS NULL. Attendance and AuditLog have no deletedAt — they are permanent.
Financial precision	All monetary values stored as Decimal(18,4). Quantities as Decimal(10,2). No Float anywhere in financial data paths. Display rounding applied at the API response layer only.

 
9. Implementation Phases
Phase	Name	Deliverables	Gate
0	Foundations	CpContextGuard, CpRolesGuard, AuditLog service, all Prisma schema additions, isce-auth invite API contract agreed, Socket.IO cp namespace	isce-auth invite contract confirmed
1	CRM Core	Organizations, Workspaces, CpCompanyProfile, CpWorkspaceMember + CpWorkspaceInvite, CpStaffProfile, Lead, CpClient, CpAppointment, public booking API	Phase 0 complete
2	Operations	CpAttendance + CRON, CpConnectCard, CpChatGateway, CpConversation, all CpNotification types wired	Phase 1 complete
3	Financials	CpInvoice, CpInvoiceItem, PDF generation, overdue CRON, invoice export	Phase 1+2 complete
4	Intelligence	Analytics module (all 4 scopes), Redis caching, Bull jobs, audit read endpoints + export	Phase 1–3 complete
5	Enterprise	Subscription gating, Paystack webhook, advanced card analytics, multi-workspace staff, hash-chained audit logs	Phase 4 complete

 
10. Senior Engineer Review — Differences & Best Practice Audit
This section documents every discrepancy between the two source documents and the resolutions applied in this unified specification. Issues are classified by severity and include the engineering rationale for each correction.

10.1  Source Document Summary
Document	Strengths	Gaps
Product PRD (v1.0)	Complete RBAC matrix, WorkspaceInvite model, AuditLog with before/after, Decimal(18,4) precision throughout, attendance unique constraint, ConnectCard status enum	Schema naming collision risk (no Cp prefix), merged WorkspaceMember/StaffProfile, company branding inline on Workspace, no confirmed JWT payload, no module file structure
Developer PRD (Engineering Spec)	Confirmed JWT payload, Cp prefix on all models, separated CpStaffProfile, separated CpCompanyProfile, defined /api/cp/ prefix, x-workspace-id header pattern, request.cp context object, full module directory structure, clean API table format	role as String (not enum), Float for financials, Decimal(18,2) insufficient, readBy Json antipattern, missing before/after in AuditLog, missing attendance unique constraint, isActive Boolean instead of enum, no CpWorkspaceInvite model, magic strings in actorId

10.2  Decisions Adopted From Developer PRD
These are improvements over the Product PRD that have been adopted in this unified document.

#	Decision	Rationale
1	Cp prefix on all model names	Prevents naming collision with existing connect-nest models (e.g. Appointment, Notification) and any future models. Critical in a shared-schema, single-DB architecture.
2	CpStaffProfile separated from CpWorkspaceMember	Clean separation of concerns: workspace membership (auth, role, invite state) vs professional identity (name, photo, department). Staff profile should survive across role changes.
3	CpCompanyProfile separated from CpWorkspace	Workspace is an operational record. Company profile is presentation data. Separating them follows single-responsibility and makes the company profile independently versionable.
4	/api/cp/ route prefix	Explicit namespace isolation from existing /api/* routes. Avoids collisions now and during future platform expansion.
5	x-workspace-id request header	Cleaner than embedding workspaceId in every route path. Allows CpContextGuard to intercept uniformly before reaching any controller. Consistent across all workspace-scoped endpoints.
6	request.cp context object	Typed context attached by the guard and passed through the request lifecycle. Eliminates redundant DB calls in services. Enables consistent role-scoped query construction.
7	CpNotification as a separate model	Decouples Connect Plus notification types from the existing Notification table. Avoids polluting the existing NotificationType enum and allows independent schema evolution.
8	CpClient.memberId FK to CpWorkspaceMember	Cleaner than a raw authUserId string. When a client gets an isce-auth account, their CpClient record is linked to the CpWorkspaceMember row, giving a clean join path for all workspace-scoped queries.
9	organizationId included in request.cp	Pre-resolving organizationId at the guard layer avoids a second DB query in Creator-scoped service methods. Particularly useful for org-level analytics.

10.3  Critical Issues — Fixed in This Document
These issues would cause incorrect behavior, data loss, or security vulnerabilities in production.

#	Issue	Source	Impact	Fix Applied
C1	Missing CpWorkspaceInvite model	Developer PRD	Invite tokens are dispatched to isce-auth but never persisted. Without a DB record: tokens cannot be validated on return, expiry cannot be enforced, there is no revocation mechanism, and the invite history is permanently lost. This is a security vulnerability.	Added CpWorkspaceInvite model with token (unique), expiresAt, status, invitedById FK, and @@index on email/token.
C2	Float used for hoursWorked and quantity	Developer PRD	IEEE 754 floating-point cannot represent many decimal fractions exactly. 0.1 + 0.2 = 0.30000000000000004 in JavaScript. Accumulated rounding errors in payroll calculations (hoursWorked × hourlyRate) and invoice totals (quantity × unitPrice) will produce incorrect results at scale.	Changed CpAttendance.hoursWorked to Decimal(5,2) and CpInvoiceItem.quantity to Decimal(10,2).
C3	Missing @@unique([staffId, date]) on CpAttendance	Developer PRD	Nothing in the schema prevents a staff member from having two CpAttendance records on the same date. A race condition on concurrent check-in requests (mobile app + web) produces duplicate records, corrupting hoursWorked calculations and attendance reporting.	Added date DateTime field (normalized to midnight UTC in application layer) + @@unique([staffId, date]) constraint.

10.4  Correctness Issues — Fixed in This Document
These issues produce incorrect or misleading behavior but do not immediately cause data loss.

#	Issue	Source	Impact	Fix Applied
H1	CpWorkspaceMember.role as String instead of CpRole enum	Developer PRD	A String field accepts any value at the database level. TypeScript cannot catch role mismatches at compile time. A typo like 'WORSPACE_ADMIN' (missing K) would be silently accepted by Prisma, produce unexpected 403s, and only surface as a runtime bug.	Changed role from String to CpRole enum on CpWorkspaceMember.
H2	Decimal(18,2) for invoice amounts	Developer PRD	Two decimal places are sufficient for display, but tax calculations with rates like 7.5% on amounts like ₦1,333.33 produce intermediate values requiring 4dp precision (₦1,333.33 × 0.075 = ₦99.9997...). Rounding at 2dp before storage causes penny errors that compound across many invoices.	Changed totalAmount, taxAmount, discountAmount to Decimal(18,4). Display rounding to 2dp applied at the API response serialization layer only.
H3	CpConnectCard.isActive Boolean	Developer PRD	A boolean can only express two states: active or inactive. Cards have four distinct states — UNASSIGNED, ACTIVE, SUSPENDED, LOST — each with different business rules. A lost card should not be reactivated the same way a suspended card is; the boolean prevents distinguishing them.	Replaced isActive Boolean with status CpCardStatus enum (UNASSIGNED / ACTIVE / SUSPENDED / LOST).
H4	CpConversationParticipant.role using CpSenderRole	Developer PRD	CpSenderRole contains SYSTEM as a value. A conversation participant cannot have the role SYSTEM — it is semantically nonsensical and would pass type-checking when it should not. The sender role of a message and the participant role in a conversation are different concepts.	Introduced CpParticipantRole enum (MEMBER / ADMIN) for CpConversationParticipant.role. CpSenderRole retained for CpMessage.senderRole.
H5	Non-nullable actorId with magic strings	Developer PRD	Using actorId = 'system' or actorId = 'external-auth' is a convention, not a type system constraint. Any string passes Prisma validation. Filtering for system events requires string matching on a nullable concept, which is fragile.	Changed actorId to String? (nullable for system events). Added isSystemEvent Boolean @default(false) for explicit, type-safe filtering.

10.5  Performance Issue — Fixed in This Document
This issue is functionally correct at low scale but will degrade significantly as data grows.

#	Issue	Source	Impact	Fix Applied
P1	readBy Json? array on CpMessage	Developer PRD	Storing read receipts as a JSON array on each message row creates three problems at scale: (1) Reading unread count requires scanning all message rows and deserializing every JSON array — O(n messages). (2) Every read event requires a READ-MODIFY-WRITE on the message row, causing row lock contention in active chats. (3) The array grows unboundedly with participants; in a 1,000-staff workspace group chat, every message row could hold a 1,000-element array.	Removed readBy Json? from CpMessage. Read tracking is now handled via lastReadAt DateTime? on CpConversationParticipant. Unread count = count of messages where createdAt > participant.lastReadAt. This is a single indexed range scan, scales to millions of messages, and requires zero per-message writes.

10.6  Missing Item — Added to This Document
#	Item	Source	Why Required
M1	CpWorkspaceInvite model	Present in Product PRD; absent from Developer PRD	See C1 above. Invite tokens dispatched to isce-auth must be persisted for validation, expiry, and revocation. Also required for the invite list endpoint (GET /staff/invites).
M2	before / after Json? fields on CpAuditLog	Present in Product PRD; absent from Developer PRD	An audit log that records 'invoice updated' without capturing the before and after state tells you that something changed, not what changed. For invoice disputes, legal compliance, and debugging, state snapshots are essential. Without them, the audit log is a list of events, not a compliance record.
M3	invites: CpWorkspaceInvite[] relation on CpWorkspace	Implied by Developer PRD logic; not in schema	Required for the CpWorkspaceInvite model to resolve. Also needed for listing pending invites per workspace.
M4	sentAt, overdueAt, pdfUrl on CpInvoice	In Product PRD; absent from Developer PRD	sentAt is needed to enforce the rule that only SENT invoices can become OVERDUE. overdueAt is needed for the CRON reporting and to distinguish when overdue status was set. pdfUrl is needed for the download endpoint.
M5	reminderSentAt on CpAppointment	In Product PRD; absent from Developer PRD	The appointment reminder CRON must track whether a reminder has been sent to avoid sending duplicates. Without this field, the CRON has no way to filter appointments that have already been reminded.

10.7  Summary: Full Diff Table
#	Area	Developer PRD	This Document	Category
1	Model name prefix	Mixed — some Cp, some not	All models prefixed Cp	Adopted
2	CpWorkspaceMember.role	String	CpRole enum	Fixed: Correctness
3	CpStaffProfile	Separate model ✓	Separate model ✓	Adopted
4	CpCompanyProfile	Separate model ✓	Separate model ✓	Adopted
5	CpAttendance date field	Absent	date DateTime + @@unique([staffId,date])	Fixed: Critical
6	CpAttendance.hoursWorked	Float	Decimal(5,2)	Fixed: Critical
7	CpConnectCard status	isActive Boolean	CpCardStatus enum	Fixed: Correctness
8	CpMessage.readBy	Json? array	Removed; lastReadAt on Participant	Fixed: Performance
9	CpConversation participant role	CpSenderRole	CpParticipantRole enum (MEMBER/ADMIN)	Fixed: Correctness
10	CpInvoice amounts	Decimal(18,2)	Decimal(18,4)	Fixed: Correctness
11	CpInvoiceItem.quantity	Float	Decimal(10,2)	Fixed: Critical
12	CpAuditLog before/after	Absent	before Json? + after Json?	Added
13	CpAuditLog.actorId	String (non-nullable, magic)	String? + isSystemEvent Boolean	Fixed: Correctness
14	CpWorkspaceInvite model	Absent	Added with token, expiry, status	Added: Critical
15	CpNotification model	Separate model ✓	Separate model ✓	Adopted
16	Route prefix	/api/cp/ ✓	/api/cp/ ✓	Adopted
17	JWT payload	Confirmed: {id, email, ...}	Confirmed: {id, email, phone, ...}	Adopted
18	x-workspace-id header	✓	✓	Adopted
19	request.cp context	✓	✓	Adopted
20	CpInvoice.sentAt / pdfUrl / overdueAt	Absent	Added	Added
21	CpAppointment.reminderSentAt	Absent	Added	Added

Document Status:  Final v2.0 — Authoritative unified specification. All source document discrepancies resolved. Ready for Phase 0 implementation.
