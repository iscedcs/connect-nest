import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CpGuardsModule } from '../guards/cp-guards.module';
import { CpSubscriptionsService } from './subscriptions.service';
import { CpSubscriptionsController } from './subscriptions.controller';
import { CpAuditLogModule } from '../audit-logs/cp-audit-log.module';

@Module({
  imports: [DatabaseModule, CpGuardsModule, CpAuditLogModule],
  controllers: [CpSubscriptionsController],
  providers: [CpSubscriptionsService],
  exports: [CpSubscriptionsService],
})
export class CpSubscriptionsModule {}
