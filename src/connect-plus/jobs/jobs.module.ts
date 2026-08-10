import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { DatabaseModule } from '../../database/database.module';
import { CpAuditLogModule } from '../audit-logs/cp-audit-log.module';

@Module({
  imports: [DatabaseModule, CpAuditLogModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
