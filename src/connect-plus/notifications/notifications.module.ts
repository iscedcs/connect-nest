import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CpNotificationsController } from './notifications.controller';
import { CpNotificationsService } from './notifications.service';
import { CpChatModule } from '../chat/chat.module';

@Module({
  imports: [DatabaseModule, forwardRef(() => CpChatModule)],
  controllers: [CpNotificationsController],
  providers: [CpNotificationsService],
  exports: [CpNotificationsService],
})
export class CpNotificationsModule {}
