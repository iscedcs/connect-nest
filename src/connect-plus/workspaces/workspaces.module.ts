import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CpGuardsModule } from '../guards/cp-guards.module';
import { CpAuditLogModule } from '../audit-logs/cp-audit-log.module';
import { CpNotificationsModule } from '../notifications/notifications.module';
import { IsceAuthModule } from '../isce-auth/isce-auth.module';
import { CpSubscriptionsModule } from '../subscriptions/subscriptions.module';
import {
  CpWorkspacesController,
  CpMyWorkspacesController,
} from './workspaces.controller';
import { CpWorkspacesService } from './workspaces.service';

@Module({
  imports: [
    DatabaseModule,
    CpGuardsModule,
    CpAuditLogModule,
    CpNotificationsModule,
    IsceAuthModule,
    CpSubscriptionsModule,
  ],
  controllers: [CpWorkspacesController, CpMyWorkspacesController],
  providers: [CpWorkspacesService],
  exports: [CpWorkspacesService],
})
export class CpWorkspacesModule {}
