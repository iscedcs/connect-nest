import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CpAuditLogModule } from '../audit-logs/cp-audit-log.module';
import { CpNotificationsModule } from '../notifications/notifications.module';
import { CpSubscriptionsModule } from '../subscriptions/subscriptions.module';
import { CpWebhooksController } from './webhooks.controller';
import { CpWebhooksService } from './webhooks.service';

@Module({
  imports: [DatabaseModule, CpAuditLogModule, CpNotificationsModule, CpSubscriptionsModule],
  controllers: [CpWebhooksController],
  providers: [CpWebhooksService],
})
export class CpWebhooksModule {}
