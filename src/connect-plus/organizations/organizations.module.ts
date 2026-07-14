import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CpGuardsModule } from '../guards/cp-guards.module';
import { CpAuditLogModule } from '../audit-logs/cp-audit-log.module';
import { CpAnalyticsModule } from '../analytics/analytics.module';
import { CpOrganizationsController } from './organizations.controller';
import { CpOrganizationsService } from './organizations.service';

@Module({
  imports: [
    DatabaseModule,
    CpGuardsModule,
    CpAuditLogModule,
    CpAnalyticsModule,
  ],
  controllers: [CpOrganizationsController],
  providers: [CpOrganizationsService],
  exports: [CpOrganizationsService],
})
export class CpOrganizationsModule {}
