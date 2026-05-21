import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CpGuardsModule } from '../guards/cp-guards.module';
import { CpAuditLogModule } from '../audit-logs/cp-audit-log.module';
import { CpNotificationsModule } from '../notifications/notifications.module';
import { CpAttendanceController } from './attendance.controller';
import { CpAttendanceService } from './attendance.service';
import { AttendanceScheduler } from './attendance.scheduler';

@Module({
  imports: [DatabaseModule, CpGuardsModule, CpAuditLogModule, CpNotificationsModule],
  controllers: [CpAttendanceController],
  providers: [CpAttendanceService, AttendanceScheduler],
  exports: [CpAttendanceService],
})
export class CpAttendanceModule {}
