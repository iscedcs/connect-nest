# **CONNECT PLUS – AUDIT & LOGGING RULES**

## **PURPOSE**

Audit & Logging ensures:

* Accountability across roles  
* Traceability of financial and operational actions  
* Compliance readiness  
* Dispute resolution (appointments, invoices, attendance)

Logs are **immutable**, **append-only**, and **never editable** by end users.

## **LOGGING ARCHITECTURE (HIGH-LEVEL)**

**Who triggers logs?**

* Users (via API actions)  
* System events (automations, status changes)  
* External integrations (Auth callbacks, payments)

**Log Context**  
Every log entry MUST include:

* `event_id`  
* `event_type`  
* `actor_role`  
* `actor_id` (Auth user ID if available)  
* `organization_id`  
* `workspace_id` (nullable for org/platform events)  
* `target_entity` (invoice, appointment, user, workspace)  
* `target_entity_id`  
* `action`  
* `timestamp`  
* `ip_address`  
* `user_agent`  
* `source` (web, mobile, API, system)

## **AUDIT VISIBILITY BY ROLE (RBAC-ALIGNED)**

| Role | Audit Visibility |
| ----- | ----- |
| Visitor / Lead | ❌ None |
| Client | Own actions only |
| Staff | Own actions only |
| Workspace Admin | Workspace-level |
| Creator | Organization-level (aggregated) |
| System Admin | Platform-level (read-only) |

## **ROLE-BASED AUDIT RULES**

### **VISITOR / LEAD**

**Logged Events**

* Appointment creation  
* Contact save trigger  
* QR / card interaction  
* Notification delivery

**Visibility**

* No audit access

### **CLIENT**

**Logged Events**

* Appointment booking/cancellation  
* Message sent to staff  
* Invoice viewed/downloaded  
* Payment attempt/success/failure

**Visibility**

* Can view **own activity history only**

### **STAFF**

**Logged Events**

* Lead validation  
* Client assignment  
* Appointment management  
* Invoice creation/edit (draft only)  
* Check-in / check-out  
* Messaging activity

**Restrictions**

* Cannot see other staff logs  
* Cannot delete or alter logs

### **WORKSPACE ADMIN**

**Logged Events**

* Staff invite/role change/suspension  
* Invoice edits, payments, exports  
* Attendance overrides  
* Workspace configuration changes

**Visibility**

* All logs within their workspace  
* Filter by:  
  * Staff  
  * Date  
  * Action type  
  * Entity

### **CREATOR (ORGANIZATION OWNER)**

**Logged Events**

* Workspace creation / archival  
* Workspace admin assignment  
* Organization settings updates

**Visibility**

* Aggregated logs across workspaces  
* Financial summaries only (no client PII)  
* No direct operational mutation logs

### **SYSTEM / SUPER ADMIN**

**Logged Events**

* Policy enforcement  
* Rate limit changes  
* Organization suspension  
* Platform configuration changes

**Visibility**

* Full platform logs (read-only)  
* No mutation of business data

## **INVOICE AUDIT RULES (CRITICAL)**

**Mandatory Logged Actions**

* Invoice creation  
* Invoice sent  
* Invoice edited (draft only)  
* Invoice marked as paid  
* Invoice overdue  
* Invoice exported  
* Payment confirmation (external callback)

**Compliance Rules**

* Paid invoices are immutable  
* All payment references must be logged  
* External payment callbacks must be traceable

## **ATTENDANCE AUDIT RULES**

**Logged Events**

* Check-in  
* Check-out  
* Auto check-out (system)  
* Admin override  
* Late arrival  
* Overtime calculation

## **NOTIFICATION AUDIT RULES**

**Logged Events**

* Notification generated  
* Notification delivered  
* Delivery failure  
* Retry attempts

**Fields**

* Channel (email, in-app, push)  
* Recipient role  
* Delivery status

## **SECURITY & INTEGRITY RULES**

* Logs are **write-once**  
* No DELETE endpoints for logs  
* Retention policy:  
  * Operational logs: 12–24 months  
  * Financial logs: 7 years  
* Encryption at rest  
* Hash-chained (optional, future)

## **EXPORT & REPORTING**

| Role | Export Capability |
| :---- | :---- |
| Client | ❌ |
| Staff | ❌ |
| Workspace Admin | ✅ (Workspace logs) |
| Creator | ✅ (Organization summary) |
| System Admin | ✅ (Platform audit) |

Exports must include:

* Time range  
* Workspace / Org filter  
* Actor role  
* Action type

## **API GUARD ENFORCEMENT (IMPORTANT)**

Every protected API MUST:

1. Pass through RBAC guard  
2. Emit audit event on success or failure  
3. Include request metadata  
4. Fail safely without blocking core flow

