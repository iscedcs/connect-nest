import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CpGuardsModule } from '../guards/cp-guards.module';
import { CpAuditLogModule } from '../audit-logs/cp-audit-log.module';
import { CpNotificationsModule } from '../notifications/notifications.module';
import { CpSubscriptionsModule } from '../subscriptions/subscriptions.module';
import { CpInvitesModule } from '../invites/invites.module';
import { CpStaffController } from './staff.controller';
import { CpStaffService } from './staff.service';

@Module({
  imports: [
    DatabaseModule,
    CpGuardsModule,
    CpAuditLogModule,
    CpNotificationsModule,
    CpSubscriptionsModule,
    CpInvitesModule,
  ],
  controllers: [CpStaffController],
  providers: [CpStaffService],
  exports: [CpStaffService],
})
export class CpStaffModule {}
