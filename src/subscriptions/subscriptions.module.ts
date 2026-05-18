import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { DatabaseModule } from '../database/database.module';
import { NotificationModule } from '../notification/notification.module';
import { PlanLimitGuard } from './guards/plan-limit.guard';

@Module({
  imports: [DatabaseModule, NotificationModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, PlanLimitGuard],
  exports: [SubscriptionsService, PlanLimitGuard],
})
export class SubscriptionsModule {}
