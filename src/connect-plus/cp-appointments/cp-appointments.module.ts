import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CpGuardsModule } from '../guards/cp-guards.module';
import { CpAuditLogModule } from '../audit-logs/cp-audit-log.module';
import { CpNotificationsModule } from '../notifications/notifications.module';
import { CpAppointmentsController } from './cp-appointments.controller';
import { CpAppointmentsService } from './cp-appointments.service';
import { AppointmentsScheduler } from './appointments.scheduler';

@Module({
  imports: [DatabaseModule, CpGuardsModule, CpAuditLogModule, CpNotificationsModule],
  controllers: [CpAppointmentsController],
  providers: [CpAppointmentsService, AppointmentsScheduler],
  exports: [CpAppointmentsService],
})
export class CpAppointmentsModule {}
