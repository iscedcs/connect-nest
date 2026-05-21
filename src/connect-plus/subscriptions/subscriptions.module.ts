import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CpGuardsModule } from '../guards/cp-guards.module';
import { CpSubscriptionsService } from './subscriptions.service';
import { CpSubscriptionsController } from './subscriptions.controller';

@Module({
  imports: [DatabaseModule, CpGuardsModule],
  controllers: [CpSubscriptionsController],
  providers: [CpSubscriptionsService],
  exports: [CpSubscriptionsService],
})
export class CpSubscriptionsModule {}
