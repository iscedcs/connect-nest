# **CONNECT PLUS – UNIFIED MASTER DOCUMENT**

## **Architecture • Implementation Plan • Product Requirements**

# **1\. EXECUTIVE OVERVIEW**

Connect Plus is a multi-tenant, enterprise-grade Customer Relationship, Staff, and Workspace Management platform that enables organizations to manage:

* Company profiles  
* Staff profiles  
* Leads & clients  
* Appointments  
* Invoices  
* Chat & communication  
* Attendance  
* Notifications  
* Analytics  
* Card (NFC/QR) interactions

All under a secure, scalable **Organization → Workspace → Profile** hierarchy with external authentication.

# **2\. PRODUCT VISION**

Provide a single operating system for service-based businesses where:

* customers connect instantly (tap/QR)  
* Staff are accountable  
* Communication is centralized  
* Billing is structured  
* Management has visibility  
* growth across branches is easy

# **3\. CORE DOMAINS (SYSTEM CAPABILITIES)**

Each domain is implemented as an independent service/module.

1. Organization & Creator Management  
2. Workspace & Company Profile  
3. Staff Profile & Attendance  
4. Leads & Clients (CRM)  
5. Appointments  
6. Chat & Messaging (Realtime)  
7. Invoices & Billing  
8. Notifications  
9. Connect Card (NFC/QR)  
10. Analytics  
11. RBAC & Authorization Layer

# **4\. SYSTEM ARCHITECTURE**

## **4.1 High-Level Architecture**

Client Apps (Web / Mobile / Card Tap Page)  
↓  
API Gateway / Core API (RBAC Enforcement)  
↓  
Domain Services (Modular)  
↓  
Database \+ Realtime \+ Queue \+ Storage

## **4.2 Components**

### **External Auth System**

* authentication  
* invitations  
* password management  
* token issuance

### **Core API (NestJS)**

* token validation  
* RBAC  
* organization/workspace scoping  
* routing to services

### **Domain Services**

* Organization Service  
* Workspace/Company Profile Service  
* Staff Profile Service  
* Client Service  
* Appointment Service  
* Chat Service (WebSocket)  
* Invoice Service  
* Attendance Service  
* Notification Service  
* Analytics Service

### **Infrastructure**

* PostgreSQL (primary DB)  
* Redis (cache \+ websocket adapter)  
* Queue (Bull/Redis)  
* Object storage (files/attachments)  
* Email/SMS providers

## **4.3 Service Interaction Flow (Example)**

Chat message:  
Client → WebSocket → Chat Service → DB → Notification Service → Recipients

Invoice created:  
Staff → API → Invoice Service → DB → Notification Service → Client

# **5\. DATA OWNERSHIP & MULTI-TENANCY**

## **Hierarchy**

Platform  
→ Organization  
→ Workspace  
→ Profiles & Records

## **Ownership Rules**

* The organization owns workspaces  
* Workspace owns all operational data  
* No cross-workspace reads  
* All queries filtered by workspace\_id

# **6\. PROFILE MODELS**

## **6.1 Company Profile (Workspace Identity)**

Includes:

* name  
* logo  
* description  
* contact info  
* address  
* business hours  
* branding/theme  
* appointment defaults  
* invoice defaults  
* notification preferences

## **6.2 Staff Profile**

Includes:

* name  
* photo  
* role  
* department  
* email (auth linked)  
* connect card  
* attendance stats  
* assigned clients  
* performance metrics

## **6.3 Client Profile**

Includes:

* contact info  
* assigned staff  
* appointments  
* invoices  
* communication history

# **7\. FEATURE SPECIFICATIONS**

## **7.1 Leads & Clients**

* Capture leads without accounts  
* staff validation  
* auto invite via auth  
* convert to client

## **7.2 Appointments**

* public (lead)  
* client (account linked)  
* reminders  
* notes  
* status tracking

## **7.3 Chat & Messaging**

Types:

* staff group chat  
* staff direct  
* staff ↔ client  
* one-way lead messages

Rules:

* workspace scoped  
* realtime (WebSocket)  
* notifications on message

Entities:

* conversation  
* participants  
* messages  
* read receipts

## **7.4 Invoices**

Capabilities:

* create invoice  
* line items  
* taxes/discounts  
* status lifecycle (draft/sent/paid/overdue/cancelled)  
* client visibility  
* reminders

## **7.5 Attendance**

* check-in/out  
* hours worked  
* late flags  
* overtime  
* optional location validation

## **7.6 Notifications**

Channels:

* in-app  
* email  
* push

Triggered by:

* messages  
* appointments  
* invoices  
* validations  
* attendance events

## **7.7 Connect Card**

Actions:

* book appointment  
* save contact  
* view profile

## **7.8 Analytics**

Levels:

* staff  
* workspace  
* organization  
* platform

Metrics:

* attendance  
* client engagement  
* appointment volume  
* invoice performance  
* message activity

# **8\. RBAC SUMMARY**

| Role | Scope |
| ----- | ----- |
| Lead | limited |
| Client | assigned only |
| Staff | workspace |
| Workspace Admin | workspace full |
| Creator | organization aggregated |
| System Admin | platform read-only |

Principles:

* least privilege  
* scope enforcement  
* token claims required

# **9\. API MODULE RESPONSIBILITIES**

## **Modules**

* /organizations  
* /workspaces  
* /company-profile  
* /staff  
* /clients  
* /appointments  
* /chat  
* /invoices  
* /attendance  
* /notifications  
* /analytics

Each module:

* validates workspace  
* validates role  
* enforces ownership

# **10\. IMPLEMENTATION PLAN**

## **Phase 0 – Foundations**

* auth integration  
* RBAC middleware  
* database schema  
* organization/workspace core

## **Phase 1 – CRM Core**

* company profile  
* staff profiles  
* leads/clients  
* appointments

## **Phase 2 – Operations**

* attendance  
* chat (WebSocket)  
* notifications

## **Phase 3 – Financials**

* invoices  
* reminders  
* reporting

## **Phase 4 – Intelligence**

* analytics engine  
* dashboards

## **Phase 5 – Enterprise**

* optimizations  
* scaling  
* integrations

# **11\. TECHNICAL CONSIDERATIONS**

## **Security**

* external auth only  
* token validation for each request  
* strict workspace filters  
* audit logs

## **Performance**

* pagination  
* indexes  
* caching  
* async jobs

## **Scalability**

* modular services  
* websocket adapter  
* background workers

## **Reliability**

* retries  
* soft deletes  
* backups

# **12\. NON-FUNCTIONAL REQUIREMENTS**

* high availability  
* low latency  
* auditability  
* compliance ready  
* multi-tenant isolation

# **13\. SUCCESS CRITERIA**

* Reduced manual admin work  
* faster client onboarding  
* Higher staff accountability  
* scalable branch expansion  
* measurable engagement improvements

# **FINAL NOTE**

Connect Plus is designed as a modular, secure, and scalable enterprise platform where each domain owns its data, roles control access, and every action is workspace-scoped.

This document serves as the single source of truth for product, engineering, and stakeholders.

