import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CpGuardsModule } from '../guards/cp-guards.module';
import { CpAuditLogModule } from '../audit-logs/cp-audit-log.module';
import { CpNotificationsModule } from '../notifications/notifications.module';
import { CpInvoicesController } from './invoices.controller';
import { CpInvoicesService } from './invoices.service';
import { CpInvoicesScheduler } from './invoices.scheduler';

@Module({
  imports: [DatabaseModule, CpGuardsModule, CpAuditLogModule, CpNotificationsModule],
  controllers: [CpInvoicesController],
  providers: [CpInvoicesService, CpInvoicesScheduler],
  exports: [CpInvoicesService],
})
export class CpInvoicesModule {}
