import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { MailClientService } from '../mail/mail-client.service';
import { HealthDependency, HealthIncidentStatus } from '../generated/prisma/client';

const FAILURE_THRESHOLD = 1;
const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class HealthMonitorService {
  private readonly logger = new Logger(HealthMonitorService.name);
  private failureCounts: Record<HealthDependency, number> = {
    [HealthDependency.POSTGRES]: 0,
  };

  constructor(
    private readonly db: DatabaseService,
    private readonly mailer: MailClientService,
  ) {}

  getCurrentFailureCounts() {
    return { ...this.failureCounts };
  }

  getThreshold() {
    return FAILURE_THRESHOLD;
  }

  /**
   * Never rejects. Callers invoke this fire-and-forget from the public /health
   * route, where an escaping rejection would terminate the process.
   */
  async checkHealth() {
    try {
      await this.checkPostgres();
    } catch (error) {
      this.logger.error(
        `Health monitoring itself failed (the dependency may be fine): ${describe(error)}`,
      );
    }
  }

  private async checkPostgres() {
    const dependency = HealthDependency.POSTGRES;
    let probeError: string | null = null;

    try {
      await this.db.$queryRaw`SELECT 1`;
    } catch (error) {
      probeError = describe(error);
    }

    // Incident bookkeeping sits outside the probe's try/catch on purpose.
    // Previously handleSuccess ran inside it, so a failure to *record* an
    // incident was reported as the dependency being down — which then called
    // triggerAlert, which touched the same broken table again and threw for
    // real. One missing table became a false POSTGRES outage, an alert email,
    // and a dead process.
    if (probeError === null) {
      await this.handleSuccess(dependency);
    } else {
      await this.handleFailure(dependency, probeError);
    }
  }

  private async handleSuccess(dependency: HealthDependency) {
    this.failureCounts[dependency] = 0;

    const openIncident = await this.db.healthIncident.findFirst({
      where: { dependency, status: HealthIncidentStatus.OPEN },
    });

    if (openIncident) {
      await this.db.healthIncident.update({
        where: { id: openIncident.id },
        data: {
          status: HealthIncidentStatus.RESOLVED,
          resolvedAt: new Date(),
        },
      });

      this.logger.log(`Incident resolved for dependency ${dependency}`);
    }
  }

  private async handleFailure(dependency: HealthDependency, errMessage: string) {
    this.failureCounts[dependency] += 1;
    const currentCount = this.failureCounts[dependency];

    this.logger.warn(
      `Health check failed for ${dependency} (${currentCount}/${FAILURE_THRESHOLD}): ${errMessage}`,
    );

    if (currentCount >= FAILURE_THRESHOLD) {
      await this.triggerAlert(dependency, errMessage);
    }
  }

  private async triggerAlert(dependency: HealthDependency, errMessage: string) {
    const now = new Date();
    let openIncident = await this.db.healthIncident.findFirst({
      where: { dependency, status: HealthIncidentStatus.OPEN },
    });

    if (!openIncident) {
      openIncident = await this.db.healthIncident.create({
        data: {
          dependency,
          status: HealthIncidentStatus.OPEN,
          startedAt: now,
          lastAlertAt: now,
          alertCount: 1,
          notifiedEmails: this.getNotificationRecipients(),
        },
      });

      await this.sendEmailAlert(dependency, errMessage, openIncident.startedAt);
    } else {
      const timeSinceLastAlert = openIncident.lastAlertAt
        ? now.getTime() - new Date(openIncident.lastAlertAt).getTime()
        : Infinity;

      if (timeSinceLastAlert >= COOLDOWN_MS) {
        await this.db.healthIncident.update({
          where: { id: openIncident.id },
          data: {
            lastAlertAt: now,
            alertCount: { increment: 1 },
          },
        });

        await this.sendEmailAlert(dependency, errMessage, openIncident.startedAt);
      }
    }
  }

  private getNotificationRecipients(): string[] {
    const raw = process.env.INCIDENT_ALERT_EMAILS;
    if (!raw) {
      return ['engineering@connect.com'];
    }
    return raw.split(',').map((e) => e.trim()).filter(Boolean);
  }

  private async sendEmailAlert(
    dependency: HealthDependency,
    errMessage: string,
    startedAt: Date,
  ) {
    const recipients = this.getNotificationRecipients();
    const subject = `[ALERT] ${dependency} Outage Detected - Connect Nest`;
    const text = `
HEALTH INCIDENT ALERT

Dependency: ${dependency}
Status: DOWN
Started At: ${startedAt.toISOString()}
Error: ${errMessage}

The dependency failed ${FAILURE_THRESHOLD} consecutive health checks.
Engineering team has been automatically notified.
    `.trim();

    for (const recipient of recipients) {
      try {
        await this.mailer.sendEmail({
          to: recipient,
          subject,
          html: `<pre>${text}</pre>`,
          text,
        });
      } catch (err) {
        this.logger.error(`Failed to send incident email to ${recipient}`, err);
      }
    }
  }
}
