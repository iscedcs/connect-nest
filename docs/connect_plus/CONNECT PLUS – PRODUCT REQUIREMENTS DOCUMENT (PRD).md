# **CONNECT PLUS – PRODUCT REQUIREMENTS DOCUMENT (PRD)**

## **1\. EXECUTIVE SUMMARY**

### **Product Name**

**Connect Plus**

### **Product Type**

Enterprise-grade Customer Relationship & Staff Management Platform with NFC/QR interaction

### **Vision**

Connect Plus enables organizations to seamlessly connect with customers, manage staff, appointments, attendance, communication, and analytics — all from a unified, secure, multi-workspace platform powered by card-tap interactions.

### **Problem Statement**

Modern businesses struggle with:

* Fragmented customer communication  
* Manual appointment handling  
* Poor staff accountability  
* Lack of centralized attendance and performance tracking  
* Inability to scale across branches or departments cleanly

### **Solution**

Connect Plus provides:

* Tap-to-interact entry points (NFC/QR)  
* Controlled lead-to-client conversion  
* Structured staff-client relationships  
* Multi-workspace enterprise architecture  
* Centralized analytics and communication  
* Externalized authentication for security and scalability

### **Target Users**

* SMEs and Enterprises  
* Multi-branch companies  
* Service-based organizations  
* Sales-driven teams  
* Professional service providers

### **Business Value**

* Increased customer engagement  
* Improved staff accountability  
* Clear data ownership  
* Scalable organization structure  
* Reduced operational friction

## **2\. PRODUCT OBJECTIVES & SUCCESS METRICS**

### **Objectives**

1. Simplify the first contact between the customer and the business  
2. Control onboarding of real clients only  
3. Improve staff productivity and accountability  
4. Support multi-branch enterprise growth  
5. Maintain strict access control and security

### **Success Metrics (KPIs)**

* Appointment conversion rate  
* Lead → Client validation rate  
* Staff attendance compliance  
* Workspace activity levels  
* Client engagement frequency  
* System uptime & API latency

## **3\. USER ROLES & PERMISSION MODEL**

### **Roles**

1. Visitor / Lead  
2. Client  
3. Staff  
4. Workspace Admin  
5. Creator (Organization Owner)  
6. System / Super Admin  
7. External Auth System (Integration Role)

### **Permission Philosophy**

* Role-based access control (RBAC)  
* Organization → Workspace → User hierarchy  
* Least-privilege enforcement  
* External Auth for identity & credentials

## **4\. CORE FEATURES (EXECUTIVE VIEW)**

### **A. Company Profile (Workspace Identity)**

* Public-facing company profile  
* Branding, contact details, and operating hours  
* Appointment, invoice, and notification defaults

### **B. Staff Profile (Employee Identity)**

* Individual staff profiles per workspace  
* Role, department, Connect Card, attendance, performance

### **C. Tap-to-Interact (Connect Card)**

* Book appointments  
* Save the company contact  
* View public company profile

### **D. Lead & Client Management**

* Lead capture without account creation  
* Staff-driven validation  
* Automated account provisioning post-validation

### **E. Appointment Management**

* Public appointments  
* Client appointments  
* Reminders, notes, and statuses

### **F. Staff Management**

* Staff profiles  
* Attendance tracking  
* Performance analytics  
* Staff-client assignment

### **G. Communication**

* Company group chat  
* Direct staff messaging  
* Limited client messaging

### **H. Workspace & Organization Management**

* Multiple workspaces per organization  
* Workspace admins  
* Creator-level ownership

### **I. Invoice Management**

* Invoice creation and lifecycle  
* Client-linked billing records

### **J. Analytics & Reporting**

* Attendance analytics  
* Engagement metrics  
* Workspace activity  
* Aggregated organization insights

## **5\. FUNCTIONAL REQUIREMENTS (TECHNICAL)**

### **5.1 Authentication & Authorization**

* Authentication is handled exclusively by the External Auth System  
* Connect Plus consumes:  
  * Auth User ID  
  * Organization ID  
  * Workspace IDs  
  * Role claims  
* No passwords stored in Connect Plus

### **5.2 Organization, Workspace & Company Profile Management**

**Organization**

* Created by Creator  
* Contains multiple workspaces  
* Has shared configurations

**Workspace (Company Profile)**

* Represents a branch, department, or business unit  
* Acts as the Company Profile  
* Stores public-facing business identity  
* Has at least one Workspace Admin  
* It is isolated from other workspaces

**Company Profile Includes**

* Company name, logo, description  
* Public contact details  
* Operating hours  
* Branding and card tap page theme  
* Invoice and appointment defaults

### **5.3 Lead → Client Lifecycle**

1. The visitor books an appointment or contacts the company  
2. Lead stored under the workspace  
3. Staff validates lead  
4. System triggers Auth invitation  
5. Client account created and linked

Constraints:

* No auto-account creation  
* Validation is mandatory

### **5.4 Staff Management, Profiles & Attendance**

**Staff Profile**

* Represents an individual employee  
* Always exists for each staff member  
* Linked to workspace and organization

Staff Profile Includes:

* Identity (name, role, department, photo)  
* Work email (linked to external Auth)  
* Connect Card information  
* Assigned clients  
* Attendance and performance data

Attendance System:

* Check-in / Check-out  
* Location validation (optional)  
* Overtime tracking  
* Late/early flags

Staff Controls:

* Suspension  
* Deletion  
* Role reassignment

### **5.5 Communication System**

Chat Types:

* Company group chat (staff only)  
* Direct staff-to-staff chat  
* Staff-to-client chat (restricted)

Rules:

* Clients cannot join staff group chats  
* Leads receive one-way messages only

### **5.6 Connect Card System**

* Each staff member has a unique card  
* Card actions:  
  * Appointment booking  
  * Contact saving  
  * Profile viewing  
* Cards paired by Workspace Admin

### **5.7 Analytics Engine**

Analytics Layers:

* Staff-level (self)  
* Workspace-level (admin)  
* Organization-level (creator)  
* Platform-level (system admin)

Data is role-filtered and read-optimized

## **6\. NON-FUNCTIONAL REQUIREMENTS**

### **Security**

* Externalized auth  
* Token validation on every request  
* Strict scope enforcement  
* Full audit logging

### **Scalability**

* Multi-tenant architecture  
* Horizontal scaling support  
* Read-optimized analytics

### **Reliability**

* High availability  
* Graceful failure handling

### **Performance**

* Low-latency API responses  
* Async processing for analytics

## **7\. SYSTEM ARCHITECTURE (SUMMARY)**

### **High-Level Components**

* **External Auth System**  
  * Handles authentication, invitations, and password setup  
  * Issues tokens containing User ID, Organization ID, Workspace IDs, and Role Claims  
* **Connect Plus Core API**  
  * Stateless API layer  
  * Validates auth tokens  
  * Enforces RBAC and workspace scoping  
* **Core Domain Services**  
  * Lead & Client Service  
  * Appointment Service  
  * Staff & Attendance Service  
  * Communication (Chat) Service  
  * Workspace & Organization Service  
  * **Invoice Service**  
  * Invoice creation, lifecycle, and tracking  
  * Workspace-scoped billing records  
* **Notification Service**  
  * Centralized event-driven notifications  
  * Handles in-app notifications, email triggers, and push (future)  
  * Subscribes to domain events (appointments, invoices, attendance, chat)  
* Analytics Service  
* **Data Layer**  
  * Multi-tenant database  
  * Organization → Workspace → Entity ownership  
  * Soft deletes and audit trails  
* **Analytics & Reporting Layer**  
  * Read-optimized  
  * Aggregated views by role

### **Invoice Architecture Integration**

* Invoice Service operates as a **workspace-scoped domain module**  
* Invoices are created by Staff or Workspace Admin  
* Invoices are linked to:  
  * Workspace ID  
  * Client ID  
  * Staff ID (creator)  
  * Optional Appointment ID  
* Payment status updates are recorded internally (no payment processing in Phase 1\)  
* External payment providers may update invoice status via webhook in later phases

## **7.1 DATA OWNERSHIP & MULTI-TENANCY MODEL**

### **Ownership Hierarchy**

* **Platform** (System Admin)  
* **Organization** (Creator)  
* **Workspace** (Workspace Admin)  
* **User / Entity** (Staff, Client)

### **Data Ownership Rules**

| Data Type | Owned By | Scope | Access Rules |
| ----- | ----- | ----- | ----- |
| Organization | Creator | Org | Creator, System Admin |
| Workspace | Organization | Workspace | Creator, Workspace Admin |
| Lead | Workspace | Workspace | Staff, Admin |
| Client | Workspace | Workspace | Assigned Staff, Admin |
| Appointment | Workspace | Workspace | Related Staff, Client |
| Staff | Workspace | Workspace | Admin, Self |
| Attendance | Workspace | Workspace | Admin, Self |
| Chat Messages | Workspace | Workspace | Participants only |
| **Invoice** | Workspace | Workspace | Staff (own), Admin (all), Client (read-only) |
| **Notification** | Workspace | Workspace | Recipient-only (role-filtered) |
| Analytics | Derived | Scoped | Role-filtered |

### **Enforcement Rules**

* Every API request must include a valid Workspace ID  
* Cross-workspace access is strictly forbidden  
* The creator can only access aggregated, non-sensitive data unless they are also a workspace admin  
* System Admin has read-only access for compliance and monitoring

## **8\. OUT OF SCOPE (PHASE 1\)**

* Payment processing  
* Public social profiles  
* Third-party CRM syncing  
* Ticketing systems

## **9\. RISKS & MITIGATIONS**

| Risk | Mitigation |
| ----- | ----- |
| Role misuse | Strict RBAC enforcement |
| Workspace data leaks | Workspace ID scoping |
| Auth dependency | Token fallback handling |
| Analytics load | Aggregation layers |

## 

## **10\. RELEASE PHASES**

**Phase 1**

* Core CRM  
* Appointments  
* Staff management  
* Attendance

**Phase 2**

* Advanced analytics  
* Creator dashboards  
* Card analytics

**Phase 3**

* Enterprise extensions  
* API integrations

## **11\. FINAL NOTE**

Connect Plus is designed as a **secure, scalable, enterprise-ready platform** with clear ownership boundaries, minimal-friction onboarding, and deep operational insight — without compromising data security or architectural clarity.

