import { Module } from '@nestjs/common';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { DatabaseModule } from 'src/database/database.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [DatabaseModule, SubscriptionsModule],
  controllers: [MeetingsController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}

