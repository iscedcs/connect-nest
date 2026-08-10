import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CpGuardsModule } from '../guards/cp-guards.module';
import { CpAuditLogModule } from '../audit-logs/cp-audit-log.module';
import { CpCompanyProfileController } from './company-profile.controller';
import { CpCompanyProfileService } from './company-profile.service';

@Module({
  imports: [DatabaseModule, CpGuardsModule, CpAuditLogModule],
  controllers: [CpCompanyProfileController],
  providers: [CpCompanyProfileService],
  exports: [CpCompanyProfileService],
})
export class CpCompanyProfileModule {}
