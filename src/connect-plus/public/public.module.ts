import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CpPublicController } from './public.controller';
import { CpPublicService } from './public.service';
import { CpNotificationsModule } from '../notifications/notifications.module';
import { CpAuditLogModule } from '../audit-logs/cp-audit-log.module';

@Module({
  imports: [DatabaseModule, CpNotificationsModule, CpAuditLogModule],
  controllers: [CpPublicController],
  providers: [CpPublicService],
})
export class CpPublicModule {}
