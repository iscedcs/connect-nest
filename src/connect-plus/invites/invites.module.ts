import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CpGuardsModule } from '../guards/cp-guards.module';
import { CpAuditLogModule } from '../audit-logs/cp-audit-log.module';
import { IsceAuthModule } from '../isce-auth/isce-auth.module';
import { CpSubscriptionsModule } from '../subscriptions/subscriptions.module';
import { CpNotificationsModule } from '../notifications/notifications.module';
import { CpInvitesController } from './invites.controller';
import { CpInvitesService } from './invites.service';

@Module({
  imports: [
    DatabaseModule,
    CpGuardsModule,
    CpAuditLogModule,
    IsceAuthModule,
    CpSubscriptionsModule,
    CpNotificationsModule,
  ],
  controllers: [CpInvitesController],
  providers: [CpInvitesService],
  exports: [CpInvitesService],
})
export class CpInvitesModule {}
