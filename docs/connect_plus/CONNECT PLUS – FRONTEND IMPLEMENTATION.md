# CONNECT PLUS — FRONTEND IMPLEMENTATION GUIDE

This document serves as a comprehensive blueprint for the Frontend Team to implement the UI/UX for **Connect Plus (C+)**. It maps directly to the completed backend APIs and Prisma architecture.

---

## 1. Authentication & Onboarding
**Backend Module:** `IsceAuthModule`, `OrganizationsModule`, `WorkspacesModule`

### Screens Needed:
- **C+ Landing / Pricing Page:** Marketing page explaining Connect vs Connect Plus, with subscription tiers.
- **Organization Creation Flow:** Step-by-step wizard to create an Organization (requires `creatorAuthId`).
- **Workspace Setup Wizard:** Create a workspace, set the slug (e.g., `workspace.isce.app/slug`), and fill in the initial `CpCompanyProfile` (logo, description, contact details).

---

## 2. Workspace Admin Dashboard
**Target Audience:** Workspace Admins & Creators

### 2.1 Team & Staff Management
- **Staff List View:** Table showing all `CpWorkspaceMember` records.
- **Invite Staff Modal:** Input for email and role assignment (`STAFF`, `WORKSPACE_ADMIN`).
- **Connect Card Manager:** UI to provision `CpConnectCard`s, assign them to staff, and handle lost/suspended cards.

### 2.2 Analytics & Audit Logs
- **Dashboard Overview:** High-level metrics (total leads, revenue from invoices, active appointments).
- **Attendance Log:** View staff check-in/check-out times, with options for Admins to override/correct records.
- **Audit Trail UI:** A read-only timeline of system events (`CpAuditLog`) for security compliance.

---

## 3. CRM & Lead Management (The Core Pipeline)
**Target Audience:** Staff & Admins
**Backend Module:** `CpLeadsModule`, `CpClientsModule`

### Screens Needed:
- **Lead Kanban / List Board:** 
  - Status columns: `NEW` ➔ `CONTACTED` ➔ `VALIDATED` ➔ `REJECTED` ➔ `CONVERTED`.
  - Display lead source (`CARD_TAP`, `QR_SCAN`, `MANUAL`, `FORM_SUBMIT`).
- **Lead Detail Drawer:** View captured data, assign to a staff member, and click "Convert to Client".
- **Client Directory:** A robust table of converted clients (`CpClient`).
- **Client Profile Page:** 360-degree view showing the client's past appointments, invoices, and chat history.

---

## 4. Appointments & Scheduling
**Backend Module:** `CpAppointmentsModule`

### Screens Needed:
- **Calendar View:** A weekly/monthly calendar showing all `CpAppointment` records for the workspace.
- **Booking Modal (Internal):** Staff can manually book an appointment for a client.
- **Booking Page (Public):** The client-facing public page where external users can pick a time slot (handling staff conflict detection).
- **Status Controls:** Buttons to mark appointments as `CONFIRMED`, `RESCHEDULED`, `COMPLETED`, or `NO_SHOW`.

---

## 5. Billing & Invoices
**Backend Module:** `CpInvoicesModule`

### Screens Needed:
- **Invoice Generator:** Form to add line items, set due dates, and select a client.
- **Invoices Dashboard:** List of invoices filterable by status (`DRAFT`, `SENT`, `PAID`, `OVERDUE`).
- **Payment Link/PDF View:** A clean layout for the client to view their invoice (and optionally pay via Paystack/Wallet integration).

---

## 6. Messaging & Collaboration
**Backend Module:** `CpChatModule`

### Screens Needed:
- **Chat Interface:** A modern UI similar to Slack/WhatsApp.
- **Conversations Sidebar:** Switch between `WORKSPACE_GROUP` (internal team chat) and `CLIENT_STAFF` (direct chat with clients).
- **Message Bubbles:** Display text, timestamp, and read receipts. Must connect to the backend WebSocket Gateway for real-time updates.

---

## 7. Artisan Talent Pool & Job Board (NEW)
**Backend Module:** `CpJobsModule`, `CpTalentModule`

### 7.1 Workspace Admin View
- **Post a Job Modal:** Form capturing `title`, `description`, `jobType` (Full-time, Contract, One-time Gig), `workModel` (Remote, Hybrid), budget, and required skills.
- **Talent Sourcing Directory:** A search interface utilizing the `searchTalent` API to browse the global Artisan directory. Include filters for skills and availability.
- **Job Dashboard:** View active job posts and review incoming applications (`CpJobApplication`), complete with links to the Artisan's Resume (`resumeUrl`).

### 7.2 Artisan View (Public/Freelancer App)
- **Job Board:** A feed of public Connect Plus jobs.
- **Apply Modal:** Submit a cover letter and attach a resume (Upload PDF directly to Digital Ocean Spaces, then send the resulting `resumeUrl` to the backend).

---

## Technical Integration Notes for Frontend

1. **API Prefix:** All Connect Plus endpoints are prefixed with `/api/cp/`.
2. **Context Headers:** Almost every secure route requires the `x-workspace-id` header to enforce multi-tenant isolation. Ensure the Axios interceptor injects this automatically based on the active workspace in the Redux/Zustand store.
3. **File Uploads:** For resumes, logos, and chat attachments, the frontend should upload physical files directly to Digital Ocean Spaces, then pass the returned `spaces_url` string to the backend APIs.
4. **WebSockets:** The Chat and Notifications features require a persistent Socket.io connection authenticated with the user's JWT.
