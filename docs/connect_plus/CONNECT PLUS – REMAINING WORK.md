# CONNECT PLUS — REMAINING WORK

This file captures the main work still left to complete for the Connect Plus feature set.

## Priority 1 — MVP Foundation

### 1. Core schema and infrastructure
- [x] Add all remaining Connect Plus enums to Prisma schema
- [x] Add all remaining Connect Plus models to Prisma schema
- [x] Run Prisma migration/push and regenerate client
- [x] Confirm the root Connect Plus module is wired into the application
- [x] Finalize request context and RBAC guards for workspace and creator flows

### 2. Organization and workspace setup
- [x] Implement organization creation for creators
- [x] Implement organization retrieval/update/archive flows
- [x] Implement workspace creation and listing
- [x] Implement workspace status lifecycle (active, suspended, archived)
- [x] Implement workspace admin invite flow
- [x] Seed company profile automatically when a workspace is created

### 3. Staff and connect card management
- [x] Implement staff invite flow
- [x] Create workspace member + staff profile linkage
- [x] Implement staff profile update and status changes
- [x] Implement role change logic for staff and workspace admins
- [x] Implement connect card creation
- [x] Implement connect card pairing and unpairing
- [x] Enforce card uniqueness and staff pairing rules

## Priority 2 — Lead, client, and public experience

### 4. Public routes
- [x] Implement public profile endpoint for workspace slug
- [x] Implement public appointment booking route
- [x] Implement public interaction logging route
- [x] Implement public contact-save route
- [x] Resolve workspace from slug for every public request

### 5. Lead and client CRM
- [x] Implement lead listing and filtering
- [x] Implement lead assignment workflow
- [x] Implement lead validation to client conversion
- [x] Implement client creation and invitation flow
- [x] Implement client reassignment workflow
- [x] Implement client profile access rules for staff and clients
- [x] Implement lead reject and soft-delete behavior

## Priority 3 — Appointments and collaboration

### 6. Appointment module
- [x] Implement appointment creation for staff and clients
- [x] Implement appointment listing and filtering by access role
- [x] Implement appointment detail retrieval
- [x] Implement appointment status updates
- [x] Implement appointment update rules
- [x] Implement client personal appointment history
- [x] Implement conflict detection for overlapping staff appointments

### 7. Chat and messaging
- [x] Implement conversation creation for workspace and client/staff interactions
- [x] Implement direct messaging flows
- [x] Implement group chat support for workspace teams
- [x] Enforce conversation visibility by role and membership

## Priority 4 — Advanced operations

### 8. Invoices
- [x] Implement invoice CRUD
- [x] Implement invoice line items
- [x] Implement invoice lifecycle states
- [x] Implement PDF/export support if required

### 9. Notifications
- [x] Implement event-driven notifications for invites, leads, appointments, and client conversion
- [x] Route notifications to the correct user or role

### 10. Attendance
- [x] Implement staff check-in and check-out
- [x] Implement attendance reporting
- [x] Implement admin override and correction flows

### 11. Analytics and audit logs
- [x] Implement workspace-level analytics views
- [x] Implement organization-wide analytics rollup
- [x] Implement immutable audit logging for important actions
- [x] Implement role-based audit log visibility

## Suggested implementation order

1. Finish the Prisma layer and RBAC foundation
2. Complete organization/workspace/company profile modules
3. Complete staff and connect card modules
4. Complete public lead capture and lead/client conversion
5. Complete appointments and messaging
6. Finish invoices, notifications, attendance, analytics, and audit logs

## Notes

The current implementation plan and user stories already define most of the acceptance criteria. This file should be used as a practical checklist while building out the remaining Connect Plus modules.
