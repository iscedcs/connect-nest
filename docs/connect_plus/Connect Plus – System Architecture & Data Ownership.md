# **CONNECT PLUS – SYSTEM ARCHITECTURE DIAGRAM (UPDATED)**

## **HIGH-LEVEL VIEW**

* ┌──────────────────────────┐  
* │        End Users         │  
* │──────────────────────────│  
* │ Visitor / Lead           │  
* │ Client                   │  
* │ Staff                    │  
* │ Workspace Admin           │  
* │ Creator                  │  
* └───────────┬──────────────┘  
*             │  
*             ▼  
* ┌──────────────────────────┐  
* │   Web / Mobile Frontend  │  
* │  (Next.js / Mobile App)  │  
* └───────────┬──────────────┘  
*             │  Auth Token \+ Org ID \+ Workspace ID  
*             ▼  
* ┌──────────────────────────┐  
* │   API Gateway / BFF      │  
* │  (Rate limit, routing)   │  
* └───────────┬──────────────┘  
*             │  
*             ▼  
* ┌───────────────────────────────────────────┐  
* │            CONNECT PLUS CORE API           │  
* │        (NestJS / Modular Monolith)         │  
* └───────────────────────────────────────────┘

## 

## 

## **AUTHENTICATION & AUTHORIZATION LAYER**

* ┌──────────────────────────┐  
* │   External Auth System   │  
* │──────────────────────────│  
* │ \- Authenticate users     │  
* │ \- Issue JWT tokens       │  
* │ \- Handle invitations     │  
* │ \- Password setup         │  
* └───────────┬──────────────┘  
*             │  (JWT, Claims)  
*             ▼  
* ┌──────────────────────────┐  
* │   Auth Guard (Internal)  │  
* │──────────────────────────│  
* │ \- Validate token         │  
* │ \- Extract role           │  
* │ \- Extract org/workspace  │  
* │ \- Enforce RBAC           │  
* └──────────────────────────┘


**Important**:  
Connect Plus **never stores passwords**.  
It only trusts **verified tokens \+ role claims**.

## **CORE DOMAIN MODULES (INSIDE CONNECT PLUS)**

* ┌─────────────────────────────────────────────────────────┐  
* │                     CORE MODULES                         │  
* ├─────────────────────────────────────────────────────────┤  
* │ Organization Module                                      │  
* │ \- Organizations                                          │  
* │ \- Creators                                               │  
* │                                                         │  
* │ Workspace Module                                         │  
* │ \- Workspaces                                             │  
* │ \- Workspace Admins                                       │  
* │                                                         │  
* │ User & Role Mapping Module                               │  
* │ \- Staff                                                  │  
* │ \- Clients                                                │  
* │ \- Role bindings (RBAC)                                   │  
* │                                                         │  
* │ Appointment Module                                      │  
* │ \- Booking                                                │  
* │ \- Scheduling                                             │  
* │ \- Status tracking                                        │  
* │                                                         │  
* │ Messaging Module                                        │  
* │ \- Client ↔ Staff chat                                    │  
* │ \- Staff group chat                                       │  
* │                                                         │  
* │ Attendance Module                                       │  
* │ \- Check-in / Check-out                                   │  
* │ \- Overtime                                               │  
* │                                                         │  
* │ Invoice Module                                          │  
* │ \- Invoice lifecycle                                      │  
* │ \- PDF generation                                         │  
* │ \- External payment refs                                  │  
* │                                                         │  
* │ Notification Module                                     │  
* │ \- Email / In-app                                         │  
* │ \- Event-driven                                           │  
* │                                                         │  
* │ Audit & Logging Module                                  │  
* │ \- Immutable logs                                         │  
* │ \- Financial compliance                                   │  
* └─────────────────────────────────────────────────────────┘

## 

## 

## 

## 

## **EVENT-DRIVEN FLOW (Invoices, Notifications, Audits)**

* ┌──────────────┐  
* │  User Action │  
* └──────┬───────┘  
*        ▼  
* ┌────────────────────┐  
* │ Business Operation │  
* │ (e.g., Create Invoice)  
* └──────┬─────────────┘  
*        │  
*        ├──────────▶ Audit Log Event  
*        │  
*        ├──────────▶ Notification Event  
*        │  
*        └──────────▶ Analytics Event


Every **successful OR failed action** emits:

* Audit log  
* Optional notification  
* Metrics signal

## **INVOICE & PAYMENT ARCHITECTURE**

* ┌──────────────┐  
* │ Staff/Admin  │  
* └──────┬───────┘  
*        ▼  
* ┌──────────────────┐  
* │ Invoice Module   │  
* │ \- Draft          │  
* │ \- Sent           │  
* │ \- Paid           │  
* │ \- Overdue        │  
* └──────┬───────────┘  
*        │  
*        ├────────▶ Notification Module  
*        │  
*        ├────────▶ Audit Log Module  
*        │  
*        └────────▶ External Payment Provider  
*                  (Paystack / Bank / Manual)


Payment confirmation returns via **webhook** → logged → invoice locked.

## **AUDIT & LOGGING ARCHITECTURE (IMMUTABLE)**

* ┌──────────────────────────┐  
* │     All Core Modules     │  
* └───────────┬──────────────┘  
*             ▼  
* ┌──────────────────────────┐  
* │   Audit & Logging Layer  │  
* │──────────────────────────│  
* │ \- Append-only storage    │  
* │ \- Hash chaining (opt)    │  
* │ \- Role-based visibility  │  
* └───────────┬──────────────┘  
*             ▼  
* ┌──────────────────────────┐  
* │   Audit Log Database     │  
* │──────────────────────────│  
* │ \- Operational logs       │  
* │ \- Financial logs         │  
* │ \- Security logs          │  
* └──────────────────────────┘

## **NOTIFICATION DELIVERY ARCHITECTURE**

* ┌──────────────────────────┐  
* │ Notification Module     │  
* └───────────┬──────────────┘  
*             │  
*     ┌───────┼────────┐  
*     ▼       ▼        ▼  
* ┌────────┐ ┌────────┐ ┌──────────┐  
* │ Email  │ │ In-App │ │ Push (F) │  
* └────────┘ └────────┘ └──────────┘


(F) \= Future

Each delivery attempt is **logged and retry-aware**.

## **DATA OWNERSHIP & ISOLATION**

* Platform (System Admin)  
*    └── Organization (Creator)  
*          └── Workspace  
*                ├── Staff  
*                ├── Clients  
*                ├── Appointments  
*                ├── Invoices  
*                ├── Attendance  
*                └── Logs


✔ No cross-workspace leakage  
✔ Strong tenant isolation  
✔ Creator sees **aggregates only**

## **SECURITY & COMPLIANCE GUARANTEES**

* RBAC is enforced at **API Guard**  
* Audit logs are **non-deletable**  
* Financial data is immutable after payment  
* External Auth is fully isolated  
* GDPR / enterprise audit-ready

