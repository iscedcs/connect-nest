import { Module } from '@nestjs/common';
import { TalentController } from './talent.controller';
import { TalentService } from './talent.service';
import { DatabaseModule } from '../../database/database.module';
import { CpAuditLogModule } from '../audit-logs/cp-audit-log.module';
import { CpNotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [DatabaseModule, CpAuditLogModule, CpNotificationsModule],
  controllers: [TalentController],
  providers: [TalentService],
  exports: [TalentService],
})
export class TalentModule {}
