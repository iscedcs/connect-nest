# GoHighLevel (GHL) vs. `connect-nest` — Feature Gap Analysis

This document details the capabilities **GoHighLevel (GHL)** provides that are **not currently implemented** in `connect-nest` (LYNCON Connect + Connect Plus + Artisan Marketplace), along with notes on where `connect-nest` has a partial foundation.

---

## 1. Executive Summary

* **`connect-nest`** is a NestJS + Prisma backend focused on **digital business cards (NFC/QR)**, **workspace business operations** (`Connect Plus`: leads, clients, appointments, invoices, staff attendance, internal/client Socket.IO chat, jobs/talent), and an **Artisan service marketplace** (directory, bookings, proposal threads, reviews, promotions).
* **GoHighLevel** is an all-in-one **marketing, sales automation, omnichannel communications, and agency SaaS** platform.

The largest functional gaps in `connect-nest` fall into six areas:
1. **Visual Workflow & Marketing Automation** (if-this-then-that triggers, drip sequences, scheduled follow-ups)
2. **Omnichannel Messaging & Unified Inbox** (2-way SMS, WhatsApp, voice/call tracking, IG/FB/Google DM aggregation, bulk email campaigns)
3. **AI Employees** (Conversation AI, Voice AI, Content AI)
4. **No-Code Page, Funnel & Social Builders** (drag-and-drop websites, sales funnels, quiz funnels, social media scheduler)
5. **Agency White-Labeling & SaaS Reselling** (custom agency domains, branded SaaS reselling, sub-account Snapshots)
6. **Retention & Monetization Portals** (online courses/memberships, communities, automated external Google/Facebook review requests)

---

## 2. Detailed Feature Gaps (What GHL Has That `connect-nest` Doesn't)

### 2.1 Multi-Tenancy, Agency Mode & White-Labeling

| GHL Feature | Description | `connect-nest` Status |
| :--- | :--- | :--- |
| **White-Label SaaS Mode** | Agencies strip GHL branding, apply their own logo, custom domain, and resell the platform as their own SaaS with custom pricing tiers. | **Not implemented.** `CpOrganization` → `CpWorkspace` supports multi-workspace isolation for a single creator's business, not agency-to-client white-label SaaS reselling. |
| **Agency Master Dashboard** | Top-level agency view to manage unrelated client sub-accounts, rebilling, and usage markups. | **Not implemented.** `CpOrganization` models one organization per `CREATOR` with internal branches/teams (`CpWorkspace`). |
| **Snapshots (Workspace Templates)** | Pre-built, exportable/importable templates containing funnels, pipelines, workflows, forms, and campaigns that can be cloned into new sub-accounts in one click. | **Not implemented.** Only `FormTemplate` exists for forms; no full workspace/automation/funnel cloning exists. |

---

### 2.2 Lead Capture, Builders & Social Publishing

| GHL Feature | Description | `connect-nest` Status |
| :--- | :--- | :--- |
| **Drag-and-Drop Website & Funnel Builder** | Visual builder for multi-step sales funnels, landing pages, upsells/downsells, A/B split testing, and custom domains. | **Not implemented.** `connect-nest` serves structured JSON for digital cards (`Profile`, `ConnectConfig`, `CpCompanyProfile`) rather than arbitrary landing pages/funnels. |
| **Surveys & Quiz Funnels** | Multi-step conditional surveys and scoring quizzes that branch based on answers and tag leads. | **Partial foundation.** `Form`, `FormTemplate`, and `Submission` support custom JSON field definitions and submissions, but without conditional branching, quiz scoring, or funnel steps. |
| **Social Media Planner** | Schedule and publish posts across Instagram, Facebook, LinkedIn, Google Business Profile, and TikTok from one calendar. | **Not implemented.** `Social` only stores static links to a user's social profiles. |
| **Call Tracking & Dynamic Number Insertion** | Track inbound phone calls from ads/landing pages, record calls, and attribute leads to campaigns. | **Not implemented.** No telephony/SIP/call-tracking integration exists. |

---

### 2.3 Omnichannel Messaging & Unified Inbox

| GHL Feature | Description | `connect-nest` Status |
| :--- | :--- | :--- |
| **Unified Omnichannel Inbox** | Single inbox combining 2-way SMS, email threads, Instagram DMs, Facebook Messenger, WhatsApp, and Google Business chat per contact. | **Partial foundation.** `CpConversation`/`CpMessage` and `BookingThread`/`ThreadMessage` provide real-time in-app Socket.IO chat, but only within the platform—no external channel aggregation. |
| **2-Way SMS & MMS** | Send and receive SMS/MMS directly from contact records and workflows (typically via Twilio/LeadConnector). | **Not implemented.** No SMS provider integration exists in `src/`. |
| **WhatsApp Business Integration** | Official 2-way WhatsApp messaging, template messages, and automated WhatsApp follow-ups. | **Not implemented.** |
| **Ringless Voicemail Drops** | Automated pre-recorded voicemail drops sent directly to a lead's voicemail box. | **Not implemented.** |
| **Email Marketing & Broadcasts** | Drag-and-drop email builder, newsletter broadcasts, segmentation, open/click tracking, and unsubscribe management. | **Partial foundation.** `mail/` (Resend/Nodemailer) handles transactional emails only—no campaign builder, audience segmentation, or open/click analytics. |

---

### 2.4 Visual Workflow & Sales Automation

| GHL Feature | Description | `connect-nest` Status |
| :--- | :--- | :--- |
| **Visual "If-This-Then-That" Workflow Builder** | Node-based automation engine triggered by events (form submitted, tag added, appointment booked, invoice paid) with delays, if/else branches, webhooks, and actions. | **Not implemented.** Business logic is hard-coded in NestJS services and Bull queues rather than user-configurable automation rules. |
| **Speed-to-Lead Auto-Responders** | Automatically text/email a new lead within seconds of form submission or missed call. | **Not implemented.** `CpLead` supports creation and manual `assign`/`validate`/`reject` transitions, not automated multi-step follow-up sequences. |
| **Automated Appointment Reminders & No-Show Workflows** | Configurable multi-channel reminders (SMS + email) 24h/1h before an appointment and automatic re-booking sequences on no-show. | **Partial foundation.** `CpAppointment` and `Booking` exist, alongside `Notification`/`CpNotification` and `push/`, but there is no user-configurable reminder/no-show automation sequence. |
| **Contact Tagging & Smart Lists** | Dynamic contact segmentation based on tags, custom fields, interaction history, and pipeline stage. | **Not implemented.** `CpLead` and `CpClient` have basic status/assignment fields without dynamic smart lists or automation tags. |

---

### 2.5 Sales Pipelines, Scheduling & Commerce

| GHL Feature | Description | `connect-nest` Status |
| :--- | :--- | :--- |
| **Configurable Kanban Sales Pipelines** | Multiple custom pipelines per workspace with user-defined deal stages, monetary deal values, win/loss probability, and stage-change triggers. | **Partial foundation.** `CpLead` has fixed statuses (`validate`/`reject`) and `Booking` has fixed states (`PENDING` → `CONFIRMED` → `IN_PROGRESS` → `COMPLETED`), but there are no user-defined multi-stage Kanban pipelines with deal values. |
| **Round-Robin & Group Calendar Scheduling** | Native availability rules, calendar sync (Google/Outlook 2-way), round-robin lead distribution across staff, and collective/group bookings. | **Partial foundation.** `MeetingLink` and `AppointmentLink` store external links (Calendly, Cal.com, Zoom), and `CpAppointment` records appointments—but there is no native availability engine, 2-way Google/Outlook calendar sync, or round-robin assignment. |
| **Interactive Estimates & Proposals (with E-Sign)** | Branded proposals/contracts with e-signatures that automatically trigger invoicing and onboarding workflows upon signing. | **Partial foundation.** Artisan `BookingThread` supports structured `Proposal` messages (price, date, time), and `CpInvoice` handles invoicing, but there is no document/contract e-signature system. |
| **Native Checkout & Subscription Rebills** | Direct Stripe/payment links, order bumps, 1-click upsells, and usage-based rebilling inside funnels/invoices. | **Partial foundation.** Payments and wallets are handled externally via `isce-store-api` and `webhooks/` (`CpInvoice` supports `send`/`mark-paid`/`cancel`), without funnel checkouts or order bumps. |

---

### 2.6 AI Employees

| GHL Feature | Description | `connect-nest` Status |
| :--- | :--- | :--- |
| **Conversation AI** | Trained AI chatbots operating across SMS, web chat, IG, FB, and WhatsApp to qualify leads, answer FAQs, and book appointments directly onto calendars. | **Not implemented.** (`openai` appears in `package.json`, but has no active implementation in `src/`.) |
| **Voice AI** | Inbound and outbound AI phone agents capable of handling calls, qualifying prospects, and booking appointments in real time. | **Not implemented.** |
| **Content AI** | Built-in AI copywriting and image generation for emails, social posts, and landing pages. | **Not implemented.** |

---

### 2.7 Reputation, Courses, Communities & Affiliates

| GHL Feature | Description | `connect-nest` Status |
| :--- | :--- | :--- |
| **Automated Google & Facebook Review Requests** | Automatically send SMS/email review links after a completed job/invoice, track external review ratings, and reply (manually or with AI). | **Partial foundation.** `Review` handles *internal* Artisan marketplace reviews only; no Google Business Profile or Facebook review integration exists. |
| **Membership Portals & Online Courses** | Host video courses, drip content, quizzes, and gated student portals (Kajabi replacement). | **Not implemented.** |
| **Built-in Communities** | Private/paid community spaces with channels, posts, leaderboards, and gamification (Skool replacement). | **Not implemented.** |
| **Full Affiliate Manager** | Multi-tier affiliate tracking, commission payouts, promo links, and campaign-specific affiliate portals. | **Partial foundation.** `src/referral/` proxies basic referral summaries and business referrer applications to `isce-auth`, without campaign-level affiliate commission management. |

---

### 2.8 Usage-Based Communication Metering

| GHL Feature | Description | `connect-nest` Status |
| :--- | :--- | :--- |
| **Pay-As-You-Go Communication Wallet & Rebilling** | Metered billing per SMS segment, phone minute, email send, and AI token/minute, with agency markup options. | **Not implemented.** `Plan` and `CpPlan` enforce static feature quotas (profiles, files, storage, workspaces, staff, clients), not metered telecom/AI usage billing. |

---

## 3. Existing `connect-nest` Foundations to Leverage

If any GHL-like features are planned for `connect-nest`, the codebase already provides strong building blocks:

* **Multi-Workspace Isolation:** `CpContextGuard` + `CpRolesGuard` + `x-workspace-id` scoping (`src/connect-plus/`).
* **CRM Entities:** `CpLead`, `CpClient`, `CpAppointment`, `CpInvoice` / `CpInvoiceItem`, `Form` / `Submission`.
* **Real-Time & Async Infrastructure:** Bull/Redis queues, `@nestjs/schedule` / `cron`, `@nestjs/event-emitter`, Socket.IO gateways, FCM push, and Resend/Nodemailer.
* **Auditability:** `CpAuditLogService` for tracking all workspace mutations.
* **Unique Differentiators GHL Lacks:** Physical NFC device binding (`DeviceProfile`), tap/scan analytics (`CardInteraction`), company-issued staff cards (`CpConnectCard`), staff attendance (`CpAttendance`), and an integrated service marketplace (`src/artisan/**` + `talent/`/`jobs/`).

