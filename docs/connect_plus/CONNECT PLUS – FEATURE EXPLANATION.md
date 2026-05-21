# **CONNECT PLUS – FEATURE EXPLANATION**

Connect Plus is an advanced customer relationship and staff management system that integrates card-tapping technology (Connect Card), communication tools, appointment booking, staff attendance, workspace management, analytics, and company collaboration.

Below is a breakdown of every feature that was discussed.

# **1\. TAP-TO-INTERACT (Connect Card Features)**

When someone taps their Connect Card on a phone (NFC):

They should see these options:

### **1\. Book Appointment**

* Allows a *lead* or *client* to book a meeting with the card owner.  
* Opens a simple appointment form (name, email, reason, time/date).  
* After submitting, the system stores the appointment under that company’s workspace.

### **2\. Save Contact**

* Saves the company contact details to the user’s phone.

### **3\. View Profile (If enabled)**

* Shows the public profile of the company.  
* Only basic details; full profile is managed inside Connect Plus.

# **2\. LEADS & CLIENT MANAGEMENT**

### **Lead**

A Lead is someone who:

* Has contacted the company,  
* Or has booked an appointment,  
* But has not yet been confirmed as a client.

### **Client**

A Client is a Lead that the company staff has validated.

### **Lead → Client Conversion Flow**

1. Lead contacts the company or books an appointment.  
2. Staff reviews the lead.  
3. Staff marks the lead as **Validated (Client)**.  
4. The system **automatically creates a user account** for the person.  
5. The person receives an email invitation to **set a password & log in**.  
6. They now become a registered **Client inside the company workspace**.

# **3\. WHAT CAN LEADS DO?**

Leads can:

* Book appointments  
* Save contact  
* Fill in basic information  
* Receive messages from staff (one-way only; optional feature)

Leads **cannot chat**, cannot access the workspace, and do not have a dashboard.

# **4\. WHAT CAN CLIENTS DO?**

Clients have more access than leads.

**Clients can:**

* Book appointments (again if needed)  
* View communication history (optional)  
* View their own basic profile  
* View the services or products the company provides  
* Receive messages from staff  
* Have a dedicated staff attached to them

Clients **cannot:**

* Chat freely like employees  
* View company workspace  
* Access internal tools

Clients only interact with:

* The staff assigned to them  
* Their appointment schedule  
* Their messages  
* Company information

# **5\. STAFF-TO-CLIENT RELATIONSHIP**

* Every client is assigned to **one dedicated staff member**.  
* That staff can:  
  * Manage the client  
  * Communicate with the client  
  * Schedule appointments  
  * Track client history

This ensures accountability and personalization.

# **6\. APPOINTMENT SYSTEM**

There are two types of appointments:

### **1\. Public Appointment (Leads & visitors)**

* Booked through the tap card or the company link.  
* Stored under the company’s workspace as a lead activity.

### **2\. Client Appointment (Validated clients)**

* Managed inside the CRM.  
* Linked to their account and history.

The appointment system supports:

* Reminders  
* Status updates  
* Notes from staff

# **7\. ACCOUNT CREATION LOGIC**

### **When is an account created?**

Only when:

* A lead is validated and becomes a client, OR  
* A staff member is invited to the workspace.

Accounts are NOT created for random people.

### **Sign-in Flow**

* Account created → Invitation email sent  
* User clicks link → Creates password  
* User signs in → Redirected back to Connect Plus  
* The system knows its workspace through the **workspace ID** embedded in their profile

# **8\. WORKSPACE MANAGEMENT**

A **Workspace** represents a company or branch.

Key points:

* A company can have multiple workspaces.  
* Each workspace has a **Workspace Admin**.  
* Staff belong to workspaces.  
* Workspaces are private; users join only by **invite link**.

### **Workspace Admin can:**

* Add staff  
* Assign roles  
* Remove or suspend staff  
* See workspace analytics  
* Manage workspace settings

# **9\. STAFF MANAGEMENT & ROLES**

### **Staff Features**

* Staff profile  
* Unique Connect Card  
* Attendance tracking  
* Performance analytics  
* Ability to chat in the company group chat  
* Ability to message other staff directly

### **Blocking / Deleting Staff**

Admins can:

* Suspend staff (temporarily block access)  
* Delete staff (remove completely from workspace)  
* Reassign clients  
* Reassign tasks

# **10\. STAFF ATTENDANCE SYSTEM**

The CRM includes a full attendance system with:

### **Core Features**

* **Time Tracking:** Staff can check in and check out.  
* **Attendance Monitoring:** The system logs attendance daily.  
* **Work Hour Calculation:** Automatically calculates hours worked.  
* **Late/Early Reports:** Flags late check-ins and early check-outs.  
* **Overtime Tracking:** Tracks extra time worked.  
* **Location Mapping:** Optional — confirms staff are within the company location when checking in.

This will power analytics like:

* Daily/weekly/monthly staff attendance  
* Overtime reports  
* Productivity insights

# **11\. COMPANY CHAT SYSTEM**

### **Types of Chat**

1. **Company Group Chat**  
   * Automatically created when a company requests a workspace.  
   * All staff join automatically.  
2. **Direct Staff Messaging**  
   * One-to-one messaging between staff members.  
3. **Client Chat (limited)**  
   * Only assigned staff can message the client.  
   * Clients can reply, but do not enter the company group chat.

# **12\. ID CARD SYSTEM**

Two types:

### **1\. Digital Staff ID Card**

* Linked to staff through the onboarding process.  
* Shows name, role, department, staff number, and QR code.  
* The card is tied to a staff account using:  
  * Card code  
  * Workspace  
  * Admin approval

Admin can pair the card by:

* Entering the card code  
* Assigning to a staff member  
* Activating it

# **13\. ANALYTICS SYSTEM**

The CRM provides advanced analytics for both staff and admin:

### **Analytics Include:**

* Staff daily/weekly/monthly attendance  
* Staff performance metrics  
* Message volume (group \+ DM)  
* Card tap count (per staff)  
* Workspace activity  
* Client engagement levels  
* Sales and appointment history

This helps admins track:

* Staff performance  
* Company activity  
* Customer engagement  
* Operational efficiency

# **14\. CENTRALIZED COMMUNICATION**

All communication (appointments, messages, leads, clients, and staff) is stored in one place.

Admins can see:

* Staff interactions  
* Client history  
* Activity logs

This helps with:

* Transparency  
* Performance monitoring  
* Better service delivery

# **15\. UNIFIED WORKSPACE INFRASTRUCTURE**

All parts of the system connect under one infrastructure:

* Leads  
* Clients  
* Appointments  
* Staff  
* Attendance  
* Workspaces  
* Analytics  
* Chat  
* ID cards  
* Card tap actions

It all syncs together under the admin dashboard.

Note: there’s an external Auth