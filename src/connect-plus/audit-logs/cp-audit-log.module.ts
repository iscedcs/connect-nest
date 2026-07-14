import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CpGuardsModule } from '../guards/cp-guards.module';
import { CpAuditLogController } from './cp-audit-log.controller';
import { CpAuditLogService } from './cp-audit-log.service';

@Module({
  imports: [DatabaseModule, CpGuardsModule],
  controllers: [CpAuditLogController],
  providers: [CpAuditLogService],
  exports: [CpAuditLogService],
})
export class CpAuditLogModule {}
