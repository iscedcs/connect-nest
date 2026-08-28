import { DatabaseService } from '../../database/database.service';

export interface ActorInfo {
  name: string;
  email: string | null;
}

export interface EnrichedAuditLog {
  id: string;
  createdAt: Date;
  actorId: string | null;
  actorName: string;
  actorEmail: string | null;
  actorRole: string | null;
  isSystemEvent: boolean;
  eventType: string;
  targetEntity: string;
  targetEntityId: string;
  targetName: string | null;
  summary: string;
  action: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  source?: string;
  success?: boolean;
  errorMessage?: string | null;
  hash?: string;
  previousHash?: string | null;
  workspaceId?: string | null;
  organizationId?: string | null;
}

/**
 * Batch resolves actor information (name, email) for a set of authUserIds.
 */
export async function resolveActors(
  db: DatabaseService,
  actorIds: string[],
): Promise<Map<string, ActorInfo>> {
  const actorMap = new Map<string, ActorInfo>();
  const uniqueIds = Array.from(new Set(actorIds.filter(Boolean)));
  if (uniqueIds.length === 0) return actorMap;

  // 1. Look up in staff profiles first
  const staff = await db.cpStaffProfile.findMany({
    where: { authUserId: { in: uniqueIds }, deletedAt: null },
    select: { authUserId: true, name: true, email: true },
  });

  for (const s of staff) {
    if (s.authUserId) {
      actorMap.set(s.authUserId, {
        name: s.name || 'Staff Member',
        email: s.email ?? null,
      });
    }
  }

  // 2. For any remaining IDs, check client profiles
  const missingIds = uniqueIds.filter((id) => !actorMap.has(id));
  if (missingIds.length > 0) {
    const clients = await db.cpClient.findMany({
      where: { authUserId: { in: missingIds }, deletedAt: null },
      select: { authUserId: true, name: true, email: true },
    });

    for (const c of clients) {
      if (c.authUserId) {
        actorMap.set(c.authUserId, {
          name: c.name || 'Client',
          email: c.email ?? null,
        });
      }
    }
  }

  return actorMap;
}

/**
 * Batch resolves human-readable names for target entities in the current page.
 */
export async function resolveTargetNames(
  db: DatabaseService,
  targets: Array<{ entity: string; entityId: string }>,
): Promise<Map<string, string>> {
  const targetMap = new Map<string, string>();
  if (targets.length === 0) return targetMap;

  // Group entity IDs by entity type
  const grouped = new Map<string, Set<string>>();
  for (const t of targets) {
    if (!t.entity || !t.entityId) continue;
    if (!grouped.has(t.entity)) {
      grouped.set(t.entity, new Set());
    }
    grouped.get(t.entity)!.add(t.entityId);
  }

  const promises: Promise<void>[] = [];

  for (const [entity, idsSet] of grouped.entries()) {
    const ids = Array.from(idsSet);
    if (ids.length === 0) continue;

    switch (entity) {
      case 'CpInvoice':
        promises.push(
          (async () => {
            const invoices = await db.cpInvoice.findMany({
              where: { id: { in: ids } },
              select: { id: true, invoiceNumber: true },
            });
            for (const inv of invoices) {
              targetMap.set(
                `CpInvoice:${inv.id}`,
                inv.invoiceNumber ? `Invoice #${inv.invoiceNumber}` : 'Invoice',
              );
            }
          })(),
        );
        break;

      case 'CpStaffProfile':
        promises.push(
          (async () => {
            const staff = await db.cpStaffProfile.findMany({
              where: { id: { in: ids } },
              select: { id: true, name: true },
            });
            for (const s of staff) {
              if (s.name) targetMap.set(`CpStaffProfile:${s.id}`, s.name);
            }
          })(),
        );
        break;

      case 'CpClient':
        promises.push(
          (async () => {
            const clients = await db.cpClient.findMany({
              where: { id: { in: ids } },
              select: { id: true, name: true },
            });
            for (const c of clients) {
              if (c.name) targetMap.set(`CpClient:${c.id}`, c.name);
            }
          })(),
        );
        break;

      case 'CpWorkspace':
        promises.push(
          (async () => {
            const workspaces = await db.cpWorkspace.findMany({
              where: { id: { in: ids } },
              select: { id: true, name: true },
            });
            for (const w of workspaces) {
              if (w.name) targetMap.set(`CpWorkspace:${w.id}`, w.name);
            }
          })(),
        );
        break;

      case 'CpOrganization':
        promises.push(
          (async () => {
            const orgs = await db.cpOrganization.findMany({
              where: { id: { in: ids } },
              select: { id: true, name: true },
            });
            for (const o of orgs) {
              if (o.name) targetMap.set(`CpOrganization:${o.id}`, o.name);
            }
          })(),
        );
        break;

      case 'CpLead':
        promises.push(
          (async () => {
            const leads = await db.cpLead.findMany({
              where: { id: { in: ids } },
              select: { id: true, name: true },
            });
            for (const l of leads) {
              if (l.name) targetMap.set(`CpLead:${l.id}`, `Lead: ${l.name}`);
            }
          })(),
        );
        break;

      case 'CpAppointment':
        promises.push(
          (async () => {
            const appointments = await db.cpAppointment.findMany({
              where: { id: { in: ids } },
              select: { id: true, title: true },
            });
            for (const a of appointments) {
              if (a.title) targetMap.set(`CpAppointment:${a.id}`, a.title);
            }
          })(),
        );
        break;

      case 'CpJobPost':
        promises.push(
          (async () => {
            const jobs = await db.cpJobPost.findMany({
              where: { id: { in: ids } },
              select: { id: true, title: true },
            });
            for (const j of jobs) {
              if (j.title) targetMap.set(`CpJobPost:${j.id}`, j.title);
            }
          })(),
        );
        break;

      case 'CpCompanyProfile':
        promises.push(
          (async () => {
            const profiles = await db.cpCompanyProfile.findMany({
              where: { id: { in: ids } },
              select: { id: true, name: true },
            });
            for (const p of profiles) {
              targetMap.set(
                `CpCompanyProfile:${p.id}`,
                p.name ? `${p.name} Profile` : 'Company Profile',
              );
            }
          })(),
        );
        break;

      case 'CpWorkspaceInvite':
        promises.push(
          (async () => {
            const invites = await db.cpWorkspaceInvite.findMany({
              where: { id: { in: ids } },
              select: { id: true, email: true },
            });
            for (const inv of invites) {
              if (inv.email) {
                targetMap.set(`CpWorkspaceInvite:${inv.id}`, `Invite: ${inv.email}`);
              }
            }
          })(),
        );
        break;

      default:
        break;
    }
  }

  await Promise.all(promises);
  return targetMap;
}

/**
 * Builds a friendly human-readable summary string for an audit log entry.
 */
export function buildSummary(
  actorName: string,
  eventType: string,
  targetName: string | null,
): string {
  const isSystem = actorName.toLowerCase() === 'system';

  switch (eventType) {
    case 'COMPANY_PROFILE_UPDATED':
      return `${actorName} updated company profile`;

    case 'INVOICE_CREATED':
      return `${actorName} created ${targetName ?? 'invoice'}`;
    case 'INVOICE_UPDATED':
      return `${actorName} updated ${targetName ?? 'invoice'}`;
    case 'INVOICE_OVERDUE':
      return `${targetName ?? 'Invoice'} marked as overdue`;
    case 'INVOICE_SENT':
      return `${actorName} sent ${targetName ?? 'invoice'}`;
    case 'INVOICE_PAID':
      return `${targetName ?? 'Invoice'} marked as paid`;
    case 'INVOICE_CANCELLED':
      return `${actorName} cancelled ${targetName ?? 'invoice'}`;
    case 'INVOICE_DELETED':
      return `${actorName} deleted ${targetName ?? 'invoice'}`;

    case 'STAFF_INVITED':
      return `${actorName} invited staff ${targetName ? `(${targetName})` : 'member'}`;
    case 'STAFF_UPDATED':
      return `${actorName} updated staff profile ${targetName ? `for ${targetName}` : ''}`.trim();
    case 'STAFF_STATUS_CHANGED':
      return `${actorName} updated status for staff ${targetName ? `(${targetName})` : 'member'}`;
    case 'STAFF_ROLE_CHANGED':
      return `${actorName} updated role for staff ${targetName ? `(${targetName})` : 'member'}`;

    case 'WORKSPACE_CREATED':
      return `${actorName} created workspace ${targetName ? `"${targetName}"` : ''}`.trim();
    case 'WORKSPACE_UPDATED':
      return `${actorName} updated workspace ${targetName ? `"${targetName}"` : ''}`.trim();
    case 'WORKSPACE_DELETED':
      return `${actorName} deleted workspace ${targetName ? `"${targetName}"` : ''}`.trim();

    case 'APPOINTMENT_CREATED':
      return `${actorName} scheduled appointment ${targetName ? `"${targetName}"` : ''}`.trim();
    case 'APPOINTMENT_UPDATED':
      return `${actorName} updated appointment ${targetName ? `"${targetName}"` : ''}`.trim();
    case 'APPOINTMENT_CANCELLED':
      return `${actorName} cancelled appointment ${targetName ? `"${targetName}"` : ''}`.trim();
    case 'APPOINTMENT_COMPLETED':
      return `${actorName} completed appointment ${targetName ? `"${targetName}"` : ''}`.trim();
    case 'APPOINTMENT_NO_SHOW':
      return `Appointment ${targetName ? `"${targetName}" ` : ''}marked as no-show`;

    case 'LEAD_CREATED':
      return `${actorName} created ${targetName ?? 'lead'}`;
    case 'LEAD_UPDATED':
      return `${actorName} updated ${targetName ?? 'lead'}`;
    case 'LEAD_STATUS_CHANGED':
      return `${actorName} updated status for ${targetName ?? 'lead'}`;
    case 'LEAD_CONVERTED':
      return `${actorName} converted ${targetName ?? 'lead'}`;

    case 'CLIENT_CREATED':
      return `${actorName} added client ${targetName ? `"${targetName}"` : ''}`.trim();
    case 'CLIENT_UPDATED':
      return `${actorName} updated client ${targetName ? `"${targetName}"` : ''}`.trim();

    case 'JOB_POST_CREATED':
      return `${actorName} created job post ${targetName ? `"${targetName}"` : ''}`.trim();
    case 'JOB_POST_UPDATED':
      return `${actorName} updated job post ${targetName ? `"${targetName}"` : ''}`.trim();

    case 'ATTENDANCE_AUTO_CHECKOUT':
      return `Attendance automatically checked out`;
    case 'ATTENDANCE_CHECKIN':
      return `${actorName} checked in`;
    case 'ATTENDANCE_CHECKOUT':
      return `${actorName} checked out`;

    default: {
      const readableEvent = eventType
        .toLowerCase()
        .replace(/_/g, ' ');
      if (isSystem) {
        return `System performed ${readableEvent}${targetName ? ` on ${targetName}` : ''}`;
      }
      return `${actorName} performed ${readableEvent}${targetName ? ` on ${targetName}` : ''}`;
    }
  }
}
