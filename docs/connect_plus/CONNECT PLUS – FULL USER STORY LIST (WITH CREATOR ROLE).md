# **CONNECT PLUS – FULL USER STORY LIST (WITH CREATOR ROLE)**

## **AUTH NOTE (APPLIES TO ALL ROLES)**

Authentication is handled by an **external Auth system**.  
Connect Plus only consumes **auth tokens, organization IDs, and workspace IDs** to determine access and permissions.

## **ROLE 1: Visitor / Lead (Unauthenticated or Light Interaction User)**

### **User Story 1: Book Appointment**

**As a Visitor (Lead)**  
I want to book an appointment when a card is tapped on my device, a QR code is scanned, or I visit a company link  
So that I can request a meeting without creating an account.

**Acceptance Criteria**

* The appointment form collects name, email, reason, and date/time  
* The appointment is saved under the company workspace  
* Lead is marked as *Pending*  
* No account is created at this stage

### **User Story 2: Save Company Contact**

**As a Visitor (Lead)**  
I want to save the company’s contact details to my phone  
So that I can reach them later without re-tapping the card.

### **User Story 3: View Public Company Profile**

**As a Visitor (Lead)**  
I want to view the company’s basic public profile  
So that I understand who they are before engaging.

### **User Story 4: Receive Staff Message (Optional)**

**As a Visitor (Lead)**  
I want to receive a follow-up message from the staff  
So that I can respond without having full system access.

**Constraints**

* One-way messaging only  
* Lead cannot initiate chat  
* No dashboard access

## **ROLE 2: Client (Validated User)**

### **User Story 5: Account Creation After Validation**

**As a Client**  
I want my account to be created only after the staff validates me  
So that I don’t need an account unless I have real business with the company.

**Acceptance Criteria**

* Account is created only after validation  
* An email invitation is sent  
* Client sets password via external Auth  
* Client is linked to a workspace

### **User Story 6: Book Client Appointment**

**As a Client**  
I want to book appointments from my client's view  
So that my meetings are linked to my account history.

### **User Story 7: View Appointment & Communication History**

**As a Client**  
I want to view my past appointments and messages  
So that I can track my engagement with the company.

### **User Story 8: Communicate With Assigned Staff**

**As a Client**  
I want to message only my assigned staff member  
So that communication stays organized and personal.

**Constraints**

* No group chat access  
* No workspace visibility

### **User Story 9: View Company Services**

**As a Client**  
I want to view the company’s services or products  
So that I understand what they offer.

## **ROLE 3: Staff (Employee)**

### **User Story 10: Manage Assigned Clients**

**As a Staff Member**  
I want to see and manage my assigned clients  
So that I can communicate, schedule appointments, and track client history.

### **User Story 11: Validate Lead → Client**

**As a Staff Member**  
I want to validate a lead and convert them into a client  
So that the system can create an account and allow deeper engagement.

### **User Story 12: Chat With Team Members**

**As a Staff Member**  
I want to chat in the company group chat and message colleagues directly  
So that collaboration is centralized and efficient.

### **User Story 13: Check In and Check Out (Attendance)**

**As a Staff Member**  
I want to check in and check out daily  
So that my work hours are accurately tracked.

### **User Story 14: View My Performance Metrics**

**As a Staff Member**  
I want to see my attendance and activity metrics  
So that I understand my performance.

### **User Story 15: Use My Connect Card**

**As a Staff Member**  
I want my Connect Card to represent my identity  
So that clients can easily book appointments and contact me.

## **ROLE 4: Workspace Admin (Company / Branch Admin)**

### **User Story 16: Create & Manage Workspace**

**As a Workspace Admin**  
I want to manage my company workspace  
So that all staff, clients, and operations are centralized.

### **User Story 17: Invite and Manage Staff**

**As a Workspace Admin**  
I want to invite staff via secure links  
So that only authorized employees can join my workspace.

### **User Story 18: Assign Roles & Permissions**

**As a Workspace Admin**  
I want to assign roles and permissions to staff  
So that access is properly controlled.

### **User Story 19: Suspend or Delete Staff**

**As a Workspace Admin**  
I want to suspend or delete a staff member  
So that I can control access during disciplinary actions or exits.

### **User Story 20: Pair Physical / Digital ID Cards**

**As a Workspace Admin**  
I want to assign Connect Cards to staff  
So that their identity is verified and trackable.

### **User Story 21: View Workspace Analytics**

**As a Workspace Admin**  
I want to view analytics on staff activity, attendance, and engagement  
So that I can make informed business decisions.

### **User Story 22: Monitor Attendance & Work Hours**

**As a Workspace Admin**  
I want to monitor attendance reports and overtime  
So that productivity and compliance are ensured.

## **ROLE 5: Creator (Organization Owner / Workspace Creator)**

### **Definition**

The Creator is the original account holder who owns an **organization** and can create **multiple workspaces** for different businesses, branches, departments, or purposes.

### **User Story 23: Create an Organization**

**As a Creator**  
I want to create an organization on Connect Plus  
So that I can manage multiple businesses or branches under one ownership.

### **User Story 24: Create Multiple Workspaces**

**As a Creator**  
I want to create multiple workspaces under my organization  
So that operations can be separated by branch, department, or business unit.

### **User Story 25: Assign Workspace Admins**

**As a Creator**  
I want to assign or change Workspace Admins  
So that each workspace has independent leadership.

### **User Story 26: View All Organization Workspaces**

**As a Creator**  
I want to see all workspaces under my organization  
So that I can monitor structure and growth.

### **User Story 27: Control Workspace Lifecycle**

**As a Creator**  
I want to activate, suspend, or archive workspaces  
So that inactive workspaces do not remain operational.

### **User Story 28: View High-Level Organization Analytics**

**As a Creator**  
I want to view aggregated analytics across all workspaces  
So that I understand the overall organizational performance.

### **User Story 29: Invite Admins Across Workspaces**

**As a Creator**  
I want to invite admins into specific workspaces  
So that management responsibilities are properly delegated.

### **User Story 30: Manage Organization Settings**

**As a Creator**  
I want to manage organization-level settings  
So that shared configurations apply across all workspaces.

### **User Story 31: Transfer Organization Ownership**

**As a Creator**  
I want to transfer ownership of my organization  
So that continuity is maintained if leadership changes.

## **ROLE 6: System / Super Admin (Platform Level)**

### **User Story 32: Oversee Multiple Organizations & Workspaces**

**As a System Admin**  
I want visibility across organizations and workspaces  
So that platform usage and compliance can be monitored.

### **User Story 33: Enforce Platform Policies**

**As a System Admin**  
I want to enforce global rules and limits  
So that the platform remains secure and scalable.

## **ROLE 7: External Auth System (Integration Role)**

### **User Story 34: Authenticate Users**

**As the Auth System**  
I want to authenticate users and issue tokens  
So that Connect Plus can determine identity and access scope.

### **User Story 35: Handle Invitations & Password Setup**

**As the Auth System**  
I want to manage invitations and password creation  
So that Connect Plus does not handle sensitive credentials.

## **FEATURE 1: NOTIFICATIONS (System-Wide)**

### **Scope**

Notifications are **system-generated** and **event-driven**.  
They are delivered via:

* In-app notifications  
* Email (primary)  
* Optional push (future)

Connect Plus **does not authenticate users**; it only routes notifications based on workspace, role, and event.

### **User Story 36: Receive Appointment Notifications (Visitor / Lead)**

**As a Visitor (Lead)**  
I want to receive notifications when my appointment is created, updated, or approved  
So that I stay informed without logging into the system.

**Acceptance Criteria**

* Email notification on appointment submission  
* Email notification on approval or rejection  
* Includes staff name, date, and location  
* No dashboard access

### **User Story 37: Receive Client Notifications**

**As a Client**  
I want to receive notifications about appointments, invoices, and messages  
So that I don’t miss important updates.

**Triggers**

* Appointment scheduled/rescheduled  
* New invoice issued  
* Invoice paid or overdue  
* Message from assigned staff

###  **User Story 38: Receive Staff Notifications**

**As a Staff Member**  
I want to receive notifications about assigned leads, clients, and appointments  
So that I can respond promptly.

**Triggers**

* New lead assigned  
* Client validation request  
* Upcoming appointment reminder  
* Client message  
* Annacement   
* Private chat/group chat

### **User Story 39: Receive Workspace Admin Notifications**

**As a Workspace Admin**  
I want to receive operational notifications  
So that I can oversee staff activity and ensure a smooth business flow.

**Triggers**

* Invoice created by staff  
* Invoice overdue  
* Attendance anomalies  
* Staff suspension or role change  
* Private chat/group chat

### **User Story 40: Organization-Level Notifications**

**As a Creator**  
I want to receive high-level notifications across my organization  
So that I’m aware of business performance and risks.

**Triggers**

* Workspace created or archived  
* High invoice volume  
* Revenue summary alerts  
* Workspace inactivity alerts

## **FEATURE 2: INVOICING SYSTEM**

### **Scope**

Invoices are **workspace-owned**, optionally **staff-created**, and **client-facing**.  
Payments may be **made externally (via Paystack, bank transfer, or cash** marked as paid).

**User Story 41: View Invoice (Client)**

**As a Client**  
I want to view my invoices  
So that I can see what I owe and make payments on time.

**Acceptance Criteria**

* View the invoice list and details  
* Invoice status: Draft, Sent, Paid, Overdue  
* Download invoice (PDF)  
* View payment history

### **User Story 42: Receive Invoice Notification (Client)**

**As a Client**  
I want to be notified when an invoice is issued or overdue  
So that I can take action immediately.

**User Story 43: Create Invoice (Staff)**

**As a Staff Member**  
I want to create invoices for clients I manage  
So that billing is tied directly to my client interactions.

**Constraints**

* Can only invoice assigned clients  
* Cannot delete paid invoices  
* Draft → Send → Paid lifecycle

### **🔹 User Story 44: Manage Invoices (Workspace Admin)**

**As a Workspace Admin**  
I want to manage all invoices in my workspace  
So that billing is accurate and compliant.

**Capabilities**

* View all invoices  
* Edit draft invoices  
* Mark invoices as paid  
* Export invoice reports

### **User Story 45: Organization-Wide Invoice Analytics (Creator)**

**As a Creator**  
I want to see invoice summaries across workspaces  
So that I can understand revenue performance.

**Metrics**

* Total invoices issued  
* Paid vs unpaid  
* Revenue by workspace  
* Staff billing performance

### **🔹 User Story 46: Platform Invoice Oversight (System Admin)**

**As a System Admin**  
I want visibility into invoice activity  
So that I can monitor platform usage and enforce limits.

## **SYSTEM CONSTRAINTS (IMPORTANT)**

* Invoices belong to **workspace**, not Auth user  
* Notifications are **event-based**, not chat-based  
* External Auth handles identity, Connect Plus handles:  
  * Who gets notified  
  * What they see  
  * Which workspace it belongs to

## 

## 

## 

## **UPDATED ROLE COVERAGE SUMMARY**

| Role | Invoice | Notification |
| ----- | ----- | ----- |
| Visitor / Lead | ❌ | ✅ |
| Client | ✅ (View & Pay) | ✅ |
| Staff | ✅ (Create) | ✅ |
| Workspace Admin | ✅ (Manage) | ✅ |
| Creator | 📊 (Analytics) | ✅ |
| System Admin | 👁️ (Oversight) | ✅ |

## **ROLE INDEX**

1. Visitor / Lead  
2. Client  
3. Staff  
4. Workspace Admin  
5. Creator (Organization Owner)  
6. System / Super Admin  
7. External Auth System

