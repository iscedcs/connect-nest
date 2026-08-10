import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CpNotificationsController } from './notifications.controller';
import { CpNotificationsService } from './notifications.service';
import { CpAuditLogModule } from '../audit-logs/cp-audit-log.module';
import { CpChatModule } from '../chat/chat.module';

@Module({
  imports: [DatabaseModule, forwardRef(() => CpChatModule), CpAuditLogModule],
  controllers: [CpNotificationsController],
  providers: [CpNotificationsService],
  exports: [CpNotificationsService],
})
export class CpNotificationsModule {}
