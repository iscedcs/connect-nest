export const ANALYTICS_QUEUE = 'analytics';

export enum AnalyticsJobType {
  ATTENDANCE_REPORT = 'attendance_report',
  CLIENT_REPORT = 'client_report',
  INVOICE_REPORT = 'invoice_report',
  STAFF_REPORT = 'staff_report',
  ORG_REPORT = 'org_report',
}

export interface AnalyticsJobPayload {
  type: AnalyticsJobType;
  workspaceId?: string;
  organizationId?: string;
  staffId?: string;
  from?: string;
  to?: string;
  requestedByAuthId: string;
}
