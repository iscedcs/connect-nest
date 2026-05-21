import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';

import { CpGuardsModule } from './guards/cp-guards.module';
import { IsceAuthModule } from './isce-auth/isce-auth.module';

import { CpOrganizationsModule } from './organizations/organizations.module';
import { CpWorkspacesModule } from './workspaces/workspaces.module';
import { CpCompanyProfileModule } from './company-profile/company-profile.module';
import { CpStaffModule } from './staff/staff.module';
import { CpInvitesModule } from './invites/invites.module';
import { CpAttendanceModule } from './attendance/attendance.module';
import { CpLeadsModule } from './leads/leads.module';
import { CpClientsModule } from './clients/clients.module';
import { CpAppointmentsModule } from './cp-appointments/cp-appointments.module';
import { CpChatModule } from './chat/chat.module';
import { CpInvoicesModule } from './invoices/invoices.module';
import { CpNotificationsModule } from './notifications/notifications.module';
import { CpAnalyticsModule } from './analytics/analytics.module';
import { CpAuditLogModule } from './audit-logs/cp-audit-log.module';
import { CpPublicModule } from './public/public.module';
import { CpWebhooksModule } from './webhooks/webhooks.module';
import { CpConnectCardsModule } from './connect-cards/connect-cards.module';
import { CpSubscriptionsModule } from './subscriptions/subscriptions.module';

@Module({
  imports: [
    HttpModule,
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      redis: process.env.REDIS_URL
        ? { path: process.env.REDIS_URL }
        : { host: 'localhost', port: 6379 },
    }),
    CpGuardsModule,
    IsceAuthModule,
    CpOrganizationsModule,
    CpWorkspacesModule,
    CpCompanyProfileModule,
    CpStaffModule,
    CpInvitesModule,
    CpAttendanceModule,
    CpLeadsModule,
    CpClientsModule,
    CpAppointmentsModule,
    CpChatModule,
    CpInvoicesModule,
    CpNotificationsModule,
    CpAnalyticsModule,
    CpAuditLogModule,
    CpPublicModule,
    CpWebhooksModule,
    CpConnectCardsModule,
    CpSubscriptionsModule,
  ],
})
export class ConnectPlusModule {}

