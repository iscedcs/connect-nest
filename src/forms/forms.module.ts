import { Module } from '@nestjs/common';
import { FormsController, FormTemplatesController } from './forms.controller';
import { FormsService } from './forms.service';
import { DatabaseModule } from 'src/database/database.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [DatabaseModule, SubscriptionsModule],
  controllers: [FormsController, FormTemplatesController],
  providers: [FormsService],
  exports: [FormsService],
})
export class FormsModule {}

