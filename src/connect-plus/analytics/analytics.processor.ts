import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ANALYTICS_QUEUE, AnalyticsJobPayload, AnalyticsJobType } from './analytics.queue';
import { CpAnalyticsService } from './analytics.service';

@Processor(ANALYTICS_QUEUE)
export class AnalyticsProcessor {
  private readonly logger = new Logger(AnalyticsProcessor.name);

  constructor(private readonly analyticsService: CpAnalyticsService) {}

  @Process()
  async handleAnalyticsJob(job: Job<AnalyticsJobPayload>): Promise<void> {
    const { type, workspaceId, organizationId, staffId, from, to, requestedByAuthId } =
      job.data;

    this.logger.debug(`Processing analytics job [${type}] for requester ${requestedByAuthId}`);

    const query = { from, to };

    // Build a minimal ctx for the analytics service
    const ctx = {
      authUserId: requestedByAuthId,
      workspaceId,
      organizationId: organizationId ?? '',
      role: 'WORKSPACE_ADMIN' as const,
    } as Parameters<CpAnalyticsService['getAttendanceSummary']>[0];

    try {
      switch (type) {
        case AnalyticsJobType.ATTENDANCE_REPORT:
          await this.analyticsService.getAttendanceSummary(ctx, query);
          break;
        case AnalyticsJobType.CLIENT_REPORT:
          await this.analyticsService.getClientMetrics(ctx, query);
          break;
        case AnalyticsJobType.INVOICE_REPORT:
          await this.analyticsService.getInvoiceStats(ctx, query);
          break;
        case AnalyticsJobType.STAFF_REPORT:
          if (staffId) {
            await this.analyticsService.getStaffMetrics(ctx, staffId, query);
          }
          break;
        case AnalyticsJobType.ORG_REPORT:
          await this.analyticsService.getOrgAnalytics(ctx, query);
          break;
        default:
          this.logger.warn(`Unknown analytics job type: ${type}`);
      }
      this.logger.debug(`Analytics job [${type}] completed`);
    } catch (err) {
      this.logger.error(`Analytics job [${type}] failed: ${(err as Error).message}`);
      throw err; // Bull will mark job as failed and retry per queue config
    }
  }
}
