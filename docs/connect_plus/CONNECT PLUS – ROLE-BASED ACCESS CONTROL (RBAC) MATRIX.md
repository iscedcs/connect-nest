# **CONNECT PLUS – ROLE-BASED ACCESS CONTROL (RBAC) MATRIX**

## **RBAC PRINCIPLES**

* Authentication is handled by an **external Auth system**  
* Connect Plus authorizes access using:  
  * Auth token  
  * Organization ID  
  * Workspace ID  
  * Role mapping  
* Permissions are **scoped by workspace**, except for Creator & System Admin

## **ROLES**

1. Visitor / Lead  
2. Client  
3. Staff  
4. Workspace Admin  
5. Creator (Organization Owner)  
6. System / Super Admin  
7. External Auth System (Integration Role)

## **RBAC MATRIX**

### **VISITOR / LEAD**

| Feature | Access |
| :---- | ----- |
| View Public Company Profile | ✅ |
| Book Appointment | ✅ |
| Save Company Contact | ✅ |
| Receive Notifications (Email) | ✅ |
| Receive Staff Message (One-way) | ✅ |
| View Invoices | ❌ |
| Make Payments | ❌ |
| Dashboard Access | ❌ |

### **CLIENT**

| Feature | Access |
| :---- | ----- |
| Account Creation (Post-Validation) | ✅ |
| Book Appointments | ✅ |
| View Appointment History | ✅ |
| Message Assigned Staff | ✅ |
| View Company Services | ✅ |
| View Invoices | ✅ |
| Download Invoice (PDF) | ✅ |
| Receive Invoice Notifications | ✅ |
| Make Payments (External) | ✅ |
| Create Invoices | ❌ |
| Workspace Visibility | ❌ |

### **STAFF**

| Feature | Access |
| :---- | ----- |
| Manage Assigned Clients | ✅ |
| Validate Lead → Client | ✅ |
| Chat With Team | ✅ |
| Check-In / Check-Out | ✅ |
| View Personal Performance Metrics | ✅ |
| Use Connect Card | ✅ |
| Create Invoices (Assigned Clients) | ✅ |
| Edit Draft Invoices | ✅ |
| Delete Paid Invoices | ❌ |
| View All Workspace Invoices | ❌ |
| Receive Notifications | ✅ |

### **WORKSPACE ADMIN**

| Feature | Access |
| :---- | ----- |
| Manage Workspace | ✅ |
| Invite & Manage Staff | ✅ |
| Assign Roles & Permissions | ✅ |
| Suspend / Delete Staff | ✅ |
| Pair Cards | ✅ |
| View Workspace Analytics | ✅ |
| Monitor Attendance | ✅ |
| View All Workspace Invoices | ✅ |
| Edit / Mark Invoices as Paid | ✅ |
| Export Invoice Reports | ✅ |
| Receive Operational Notifications | ✅ |

### **CREATOR (ORGANIZATION OWNER)**

| Feature | Access |
| :---- | ----- |
| Create Organization | ✅ |
| Create Workspaces | ✅ |
| Assign Workspace Admins | ✅ |
| Activate / Suspend Workspaces | ✅ |
| View All Organization Workspaces | ✅ |
| View Organization-Wide Analytics | ✅ |
| View Invoice Summaries (All Workspaces) | ✅ |
| Receive Organization Notifications | ✅ |
| Direct Client Interaction | ❌ |

### **SYSTEM / SUPER ADMIN**

| Feature | Access |
| :---- | ----- |
| View All Organizations | ✅ |
| View All Workspaces | ✅ |
| Monitor Invoice Activity | ✅ |
| Enforce Platform Policies | ✅ |
| Apply Global Limits | ✅ |
| Modify Organization Data | ❌ |
| Engage in Client Operations | ❌ |

### **EXTERNAL AUTH SYSTEM**

| Feature | Access |
| :---- | ----- |
| Authenticate Users | ✅ |
| Issue Tokens | ✅ |
| Handle Invitations | ✅ |
| Password Setup | ✅ |
| Workspace Logic | ❌ |
| Invoice / Notification Logic | ❌ |

## **PERMISSION SCOPING SUMMARY**

| Scope | Applies To |
| :---- | :---- |
| Public | Visitor / Lead |
| Client-Scoped | Client |
| Staff-Scoped | Staff |
| Workspace-Scoped | Workspace Admin |
| Organization-Scoped | Creator |
| Platform-Scoped | System Admin |

## **KEY SECURITY RULES**

* Staff **cannot** invoice outside of assigned clients  
* Clients **cannot** see the workspace or staff lists  
* Workspace Admin overrides Staff invoice permissions  
* Creator sees **analytics only**, not operational data  
* System Admin is **read-only** for business data

## **READY FOR**

* PRD inclusion  
* Backend authorization guards  
* API gateway enforcement  
* Frontend feature gating  
* Compliance review

