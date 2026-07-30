import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { MailClientService } from '../mail/mail-client.service';
import { CpChatGateway } from '../connect-plus/chat/chat.gateway';
import {
  HealthDependency,
  HealthIncidentStatus,
} from '../generated/prisma/client';

const FAILURE_THRESHOLD = 3; // consecutive failures before escalating
const REMINDER_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const HOSTNAME = process.env.HOSTNAME ?? 'connect-nest';

@Injectable()
export class HealthMonitorService implements OnModuleInit {
  private readonly logger = new Logger(HealthMonitorService.name);

  /** In-memory consecutive failure counters per dependency */
  private readonly failureCount = new Map<HealthDependency, number>([
    [HealthDependency.POSTGRES, 0],
  ]);

  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailClientService,
    private readonly gateway: CpChatGateway,
  ) {}

  onModuleInit() {
    this.logger.log('HealthMonitorService initialised — checks every 60 s');
  }

  // ─── Periodic check ─────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_MINUTE)
  async runChecks(): Promise<void> {
    await this.checkPostgres();
  }

  // ─── Postgres check ──────────────────────────────────────────────────────

  private async checkPostgres(): Promise<void> {
    const dep = HealthDependency.POSTGRES;
    let ok = false;

    try {
      await this.db.$queryRaw`SELECT 1`;
      ok = true;
    } catch (err) {
      this.logger.warn(
        `[HealthMonitor] Postgres check failed: ${(err as Error).message}`,
      );
    }

    if (ok) {
      await this.handleRecovery(dep);
    } else {
      await this.handleFailure(dep);
    }
  }

  // ─── Failure path ────────────────────────────────────────────────────────

  private async handleFailure(dep: HealthDependency): Promise<void> {
    const count = (this.failureCount.get(dep) ?? 0) + 1;
    this.failureCount.set(dep, count);

    this.logger.warn(
      `[HealthMonitor] ${dep} failure #${count}/${FAILURE_THRESHOLD}`,
    );

    if (count < FAILURE_THRESHOLD) return;

    // Threshold reached — find or create an open incident
    let incident = await this.db.healthIncident.findFirst({
      where: { dependency: dep, status: HealthIncidentStatus.OPEN },
      orderBy: { startedAt: 'desc' },
    });

    const now = new Date();

    if (!incident) {
      // Transition into critical — open a new incident
      incident = await this.db.healthIncident.create({
        data: {
          dependency: dep,
          status: HealthIncidentStatus.OPEN,
          startedAt: now,
        },
      });

      this.logger.error(
        `[HealthMonitor] CRITICAL: ${dep} opened incident ${incident.id}`,
      );

      await this.sendAlert(incident.id, dep, now, false);
    } else {
      // Incident already open — check 30-min re-reminder cadence
      const timeSinceLastAlert = incident.lastAlertAt
        ? now.getTime() - incident.lastAlertAt.getTime()
        : Infinity;

      if (timeSinceLastAlert >= REMINDER_INTERVAL_MS) {
        this.logger.warn(
          `[HealthMonitor] Re-alerting for ongoing ${dep} incident ${incident.id}`,
        );
        await this.sendAlert(incident.id, dep, incident.startedAt, true);
      }
    }
  }

  // ─── Recovery path ───────────────────────────────────────────────────────

  private async handleRecovery(dep: HealthDependency): Promise<void> {
    const prevCount = this.failureCount.get(dep) ?? 0;
    this.failureCount.set(dep, 0);

    if (prevCount === 0) return; // was already healthy, nothing to do

    this.logger.log(`[HealthMonitor] ${dep} recovered after ${prevCount} failure(s)`);

    const incident = await this.db.healthIncident.findFirst({
      where: { dependency: dep, status: HealthIncidentStatus.OPEN },
      orderBy: { startedAt: 'desc' },
    });

    if (!incident) return;

    const now = new Date();
    const resolved = await this.db.healthIncident.update({
      where: { id: incident.id },
      data: {
        status: HealthIncidentStatus.RESOLVED,
        resolvedAt: now,
      },
    });

    const durationMs = now.getTime() - incident.startedAt.getTime();

    // Broadcast resolution to all /cp connected clients
    this.gateway.server.emit('health:resolved', {
      id: resolved.id,
      dependency: dep,
      resolvedAt: now.toISOString(),
      durationMs,
    });

    this.logger.log(
      `[HealthMonitor] Incident ${incident.id} resolved (duration ${Math.round(durationMs / 1000)}s)`,
    );
  }

  // ─── Alert delivery ──────────────────────────────────────────────────────

  private async sendAlert(
    incidentId: string,
    dep: HealthDependency,
    startedAt: Date,
    isReminder: boolean,
  ): Promise<void> {
    const emails = this.resolveAlertEmails();
    if (emails.length === 0) {
      this.logger.warn('[HealthMonitor] No alert emails configured — skipping email');
    }

    const subject = isReminder
      ? `[REMINDER] connect-nest: ${dep} still down (30 min)`
      : `[CRITICAL] connect-nest: ${dep} dependency down`;

    const html = this.buildEmailHtml(incidentId, dep, startedAt, isReminder);

    // Broadcast to all connected /cp clients
    this.gateway.server.emit('health:incident', {
      id: incidentId,
      dependency: dep,
      startedAt: startedAt.toISOString(),
      isReminder,
    });

    // Send email
    if (emails.length > 0) {
      await this.mail.sendEmail({ to: emails, subject, html });
    }

    // Update incident record with alert metadata
    await this.db.healthIncident.update({
      where: { id: incidentId },
      data: {
        lastAlertAt: new Date(),
        alertCount: { increment: 1 },
        notifiedEmails: emails,
      },
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /**
   * Resolves alert recipient emails from the HEALTH_ALERT_EMAILS env var.
   * Format: comma-separated list, e.g. "admin@example.com,ops@example.com"
   *
   * Future: replace/augment with a call to AUTH_API_URL/internal/super-admins
   * once that endpoint is available on the isce-auth service.
   */
  private resolveAlertEmails(): string[] {
    const raw = process.env.HEALTH_ALERT_EMAILS ?? '';
    return raw
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
  }

  private buildEmailHtml(
    incidentId: string,
    dep: HealthDependency,
    startedAt: Date,
    isReminder: boolean,
  ): string {
    const durationLabel = isReminder
      ? `<p><strong>Duration:</strong> ~30+ minutes and still ongoing</p>`
      : '';

    return `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
        <h2 style="color:${isReminder ? '#d97706' : '#dc2626'};margin-top:0">
          ${isReminder ? '⚠️ Reminder: Ongoing Incident' : '🚨 Critical Incident Opened'}
        </h2>
        <p><strong>Service:</strong> connect-nest (${HOSTNAME})</p>
        <p><strong>Dependency:</strong> ${dep}</p>
        <p><strong>Incident ID:</strong> <code>${incidentId}</code></p>
        <p><strong>Started at:</strong> ${startedAt.toISOString()}</p>
        <p><strong>Alert threshold:</strong> ${FAILURE_THRESHOLD} consecutive failed checks</p>
        ${durationLabel}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0"/>
        <p style="color:#6b7280;font-size:12px">
          This alert was sent by the connect-nest health monitor.
          Check <code>GET /api/health/status</code> for current state.
        </p>
      </div>
    `;
  }

  // ─── Public accessor (for admin controller) ──────────────────────────────

  getCurrentFailureCounts(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [dep, count] of this.failureCount.entries()) {
      result[dep] = count;
    }
    return result;
  }
}
