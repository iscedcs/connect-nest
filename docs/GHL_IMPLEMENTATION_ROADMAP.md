# `connect-nest` — GHL Feature Implementation Roadmap

This roadmap outlines a phased plan to implement the GoHighLevel (GHL) capabilities identified in [GHL_FEATURE_GAP_ANALYSIS.md](file:///c:/Users/USER/connect-nest/docs/GHL_FEATURE_GAP_ANALYSIS.md), tailored to `connect-nest`'s NestJS + Prisma + Bull/Redis + Socket.IO architecture.

> **Engineering Conventions Reminder (from `CLAUDE.md`):**
> * **Spec first:** Write `docs/specs/<feature>.md` before implementation.
> * **Workspace scoping:** All Connect Plus endpoints use `@UseGuards(CpContextGuard, CpRolesGuard)`, explicit `@CpRoles(...)`, and `x-workspace-id` scoping.
> * **Audit & Side Effects:** Mutations call `CpAuditLogService.write()`; async work (emails, SMS, AI, webhooks) runs via Bull queues (`@nestjs/bull`) or `@nestjs/event-emitter` so primary requests never fail.
> * **Schema:** All DB changes require Prisma migrations (`yarn prisma:migrate:dev`), and money uses `Prisma.Decimal`.

---

## Phase 1: CRM Depth & Native Scheduling (High ROI, Core Backend)
*Strengthen `CpLead`, `CpClient`, and `CpAppointment` into a full sales pipeline and booking engine without needing new third-party telecom/AI vendors yet.*

### 1.1 Configurable Kanban Sales Pipelines & Tags
* **Goal:** Replace fixed lead statuses with customizable multi-stage pipelines, deal values, and contact tagging.
* **Schema Additions (`prisma/schema.prisma`):**
  * `CpTag` (workspace-scoped) + `CpLeadTag` / `CpClientTag` join tables.
  * `CpPipeline` → `CpPipelineStage` (name, order, color, winProbability) → link `CpLead` (`stageId`, `dealValue: Decimal`, `pipelineId`).
* **Modules (`src/connect-plus/`):**
  * `pipelines/` module: CRUD for pipelines/stages, stage reordering, and `PATCH /cp/leads/:id/stage` (writes `CpAuditLog` and emits `lead.stage_changed` event).
  * `tags/` module: tag CRUD + bulk tag/untag and filterable smart-list queries on `leads/` and `clients/`.

### 1.2 Native Availability, 2-Way Calendar Sync & Round-Robin Booking
* **Goal:** Move beyond static external `MeetingLink`/`AppointmentLink` URLs to native scheduling.
* **Schema Additions:**
  * `CpCalendar` (workspace-scoped, supports `ROUND_ROBIN`, `COLLECTIVE`, or `PERSONAL` mode), `CpStaffAvailability` (weekly hours + overrides), `CpExternalCalendarToken` (encrypted OAuth tokens for Google/Microsoft).
* **Implementation:**
  * `src/connect-plus/cp-appointments/`: slot-calculation service checking `CpStaffAvailability`, existing `CpAppointment`s, and synced external busy blocks.
  * Round-robin assignment strategy (least-recently-assigned or weighted among `STAFF`).
  * Public booking endpoint under `src/connect-plus/public/` (`@PublicRoute()`, throttled) so prospects book directly from a company/card page.
  * Bull cron/worker for incremental Google Calendar / Outlook webhook sync.

### 1.3 Automated Appointment Reminders & E-Sign Proposals
* **Goal:** Reduce no-shows and formalize proposals into invoices.
* **Implementation:**
  * Schedule delayed Bull jobs on `CpAppointment` creation (e.g., T-24h, T-1h) to send `mail/` + `push/` + `CpNotification` reminders; cancel jobs if rescheduled/cancelled.
  * Extend `CpInvoice` / `BookingThread` proposals with a `CpProposal` model (sections, `Decimal` line items, `signatureData`, `signedAt`, `signedIp`), transitioning automatically to a `CpInvoice` on acceptance.

---

## Phase 2: Visual Workflow Automation Engine (The Core Engine)
*Turn `connect-nest`'s existing `@nestjs/event-emitter` + Bull/Redis stack into a user-configurable "if-this-then-that" automation engine.*

### 2.1 Event-Driven Workflow Engine (`src/connect-plus/workflows/`)
* **Schema Additions:**
  * `CpWorkflow` (workspace-scoped, `status: DRAFT | ACTIVE | PAUSED`, `triggerType`, `triggerConfig: Json`).
  * `CpWorkflowStep` (graph/tree nodes: `ACTION`, `DELAY`, `CONDITION_IF_ELSE`, `WEBHOOK`, `nextStepId`, `trueStepId`, `falseStepId`).
  * `CpWorkflowExecution` & `CpWorkflowStepLog` (tracks a lead/client moving through steps, supports pause/resume after delays).
* **Triggers (Emitted via `@nestjs/event-emitter`):**
  * `card.tapped` (`CardInteraction` / `CpConnectCard`)
  * `form.submitted` (`Submission`)
  * `lead.created`, `lead.stage_changed`, `tag.added`
  * `appointment.booked`, `appointment.cancelled`
  * `invoice.paid`, `invoice.overdue`
* **Execution Runtime:**
  * A `WorkflowListener` catches domain events and enqueues `WorkflowExecution` jobs in Bull.
  * `DELAY` nodes schedule delayed Bull jobs (`delay` ms) to resume at `nextStepId`.
  * `CONDITION_IF_ELSE` nodes evaluate contact tags, custom fields, or pipeline stage before branching.
  * Initial actions: Send Email (`mail/`), Assign Staff, Move Pipeline Stage, Add/Remove Tag, Create Task/Notification, Outbound Webhook (`axios` with SSRF protection + HMAC signature).

---

## Phase 3: Omnichannel Communications & Unified Inbox
*Extend `CpConversation`/`CpMessage` and `mail/` into an external-facing communication hub.*

### 3.1 2-Way SMS & WhatsApp Integration (`src/connect-plus/messaging/`)
* **Provider Layer:** Abstract `MessagingProvider` interface (e.g., Twilio / Termii / Meta WhatsApp Cloud API).
* **Schema Additions:**
  * `CpChannelAccount` (workspace-scoped phone numbers, WhatsApp Business IDs, social page tokens).
  * Extend `CpConversation` with `channel: IN_APP | SMS | WHATSAPP | EMAIL | IG | FB` and `externalThreadId`; extend `CpMessage` with `direction: INBOUND | OUTBOUND`, `deliveryStatus`, `externalMessageId`.
* **Webhooks & Unified Inbox:**
  * Public webhook receiver in `src/connect-plus/webhooks/` (signature-verified, rate-limited) to ingest inbound SMS/WhatsApp/IG/FB messages, match/create a `CpLead`, append to `CpConversation`, and broadcast over `/cp` Socket.IO gateway in real time.
  * Add `SEND_SMS` and `SEND_WHATSAPP` action nodes to Phase 2's Workflow Engine (enabling instant speed-to-lead auto-responders).

### 3.2 Email Marketing & Broadcast Campaigns
* **Schema Additions:** `CpEmailCampaign`, `CpEmailTemplate`, `CpEmailEvent` (`SENT`, `DELIVERED`, `OPENED`, `CLICKED`, `BOUNCED`, `UNSUBSCRIBED`).
* **Implementation:**
  * Batch sending via Bull queue over Resend (using Resend webhooks for open/click/bounce tracking).
  * Audience targeting via Phase 1 tags/smart lists and mandatory unsubscribe token handling.

### 3.3 Usage-Based Communication Metering
* **Goal:** Prevent unbounded SMS/WhatsApp/email costs per workspace.
* **Implementation:**
  * `CpUsageLedger` (workspace-scoped credits/debits using `Prisma.Decimal`) + `CpPlan` monthly allowances.
  * Pre-send balance/quota check in `messaging/` and settlement webhooks integrated with `isce-store-api`.

---

## Phase 4: AI Employees (Leveraging Existing `openai` Dependency)
*Activate the `openai` package already present in `package.json` to power workspace AI agents.*

### 4.1 Content AI (Fastest Win)
* **Implementation:** `src/connect-plus/ai/` service offering endpoints to draft email campaigns, SMS replies, proposal copy, and artisan service descriptions using workspace context (`CpCompanyProfile`).
* **Guardrails:** Rate-limit per workspace and meter token usage in `CpUsageLedger`.

### 4.2 Conversation AI (Inbox & Booking Bot)
* **Implementation:**
  * `CpAiAgentConfig` (workspace-scoped system prompt, FAQ knowledge base / uploaded `FileItem` chunks, allowed actions, handoff rules).
  * Hook into inbound `CpMessage` events (web chat, SMS, WhatsApp): if AI mode is active on the conversation, generate a reply and optionally invoke tool calls to query Phase 1.2 availability and create a `CpAppointment`.
  * Automatic human handoff (pause AI + notify assigned `STAFF`) on low confidence or explicit user request.

### 4.3 Voice AI & Call Tracking (Optional / Later)
* **Implementation:** Integrate a real-time voice/telephony bridge (e.g., Twilio Media Streams / SIP + OpenAI Realtime API) for inbound call handling, call recording storage in DigitalOcean Spaces, transcription, and missed-call text-back triggers into the Workflow Engine.

---

## Phase 5: Retention, Reputation & Content Portals

### 5.1 External Reputation Management (Google & Facebook Reviews)
* **Implementation:**
  * Workflow action `REQUEST_REVIEW` triggered on `invoice.paid` or `booking.completed` sending an SMS/email link.
  * OAuth integration with Google Business Profile / Meta Graph API to pull external reviews into the workspace and allow staff or Content AI to post replies.

### 5.2 Conditional Surveys & Quiz Funnels
* **Implementation:** Extend `Form` (`schema: Json`) to support multi-step pages, conditional jump logic, and lead scoring rules that auto-tag `CpLead`s and trigger workflows on `Submission`.

### 5.3 Membership Portals, Courses & Communities (Lower Priority)
* **Scope Decision:** Only build if `connect-nest` aims to compete with Kajabi/Skool. Requires `CpCourse`, `CpModule`, `CpLesson` (video hosting/signed S3 URLs), `CpEnrollment`, and gated `CpCommunityChannel`/`CpPost` models integrated with `isce-store-api` checkouts.

---

## Phase 6: Builders, Snapshots & White-Label SaaS Mode

### 6.1 Workspace Snapshots (Templates)
* **Implementation:** Serializer/importer service that exports a workspace's `CpPipeline`, `FormTemplate`, `CpWorkflow`, and `CpEmailTemplate` definitions as a versioned JSON snapshot and clones them into a newly created `CpWorkspace`.

### 6.2 Landing Page / Funnel Builder & White-Labeling
* **Implementation:**
  * `CpPage` / `CpFunnel` models storing JSON block schemas rendered by `connect-web` on custom domains (`CpWorkspaceDomain` with CNAME verification + `CpContextGuard` host-header resolution).
  * **White-Label SaaS Reselling:** Extend `CpOrganization` with custom branding, custom mailer domain (DKIM/SPF), and agency-defined `CpPlan` tiers billed via `isce-store-api`—turning `CpWorkspace`s into resellable client sub-accounts.

---

## Recommended Execution Order

| Priority | Phase | Why Now |
| :--- | :--- | :--- |
| **1** | **Phase 1** (Kanban Pipelines, Tags, Native Calendar, Reminders) | Zero new external vendor dependencies; immediately upgrades `CpLead`, `CpAppointment`, and `CpInvoice` for existing `Connect Plus` users. |
| **2** | **Phase 2** (Workflow Automation Engine) | Turns NFC card taps (`CardInteraction`) and `Form` submissions into automated follow-ups using existing Bull/Redis + EventEmitter. |
| **3** | **Phase 3** (2-Way SMS/WhatsApp, Unified Inbox, Metering) | Unlocks GHL's highest-value daily driver (speed-to-lead & omnichannel inbox) once workflows exist to drive it. |
| **4** | **Phase 4** (Content AI → Conversation AI) | Builds directly on Phase 1 scheduling + Phase 3 inbox using the `openai` SDK already in `package.json`. |
| **5** | **Phase 5 & 6** (Reviews, Snapshots, Funnels, White-Label SaaS) | Expansion/agency-tier features once core automation and messaging are proven. |

