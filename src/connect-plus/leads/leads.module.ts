import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CpGuardsModule } from '../guards/cp-guards.module';
import { CpAuditLogModule } from '../audit-logs/cp-audit-log.module';
import { CpNotificationsModule } from '../notifications/notifications.module';
import { IsceAuthModule } from '../isce-auth/isce-auth.module';
import { CpSubscriptionsModule } from '../subscriptions/subscriptions.module';
import { CpLeadsController } from './leads.controller';
import { CpLeadsService } from './leads.service';

@Module({
  imports: [
    DatabaseModule,
    CpGuardsModule,
    CpAuditLogModule,
    CpNotificationsModule,
    IsceAuthModule,
    CpSubscriptionsModule,
  ],
  controllers: [CpLeadsController],
  providers: [CpLeadsService],
  exports: [CpLeadsService],
})
export class CpLeadsModule {}
