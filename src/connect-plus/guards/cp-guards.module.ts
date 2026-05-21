import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CpContextGuard } from './cp-context.guard';
import { CpRolesGuard } from './cp-roles.guard';

@Module({
  imports: [DatabaseModule],
  providers: [CpContextGuard, CpRolesGuard],
  exports: [CpContextGuard, CpRolesGuard],
})
export class CpGuardsModule {}
