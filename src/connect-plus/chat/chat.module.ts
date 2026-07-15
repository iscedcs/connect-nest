import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../../database/database.module';
import { CpGuardsModule } from '../guards/cp-guards.module';
import { CpChatController } from './chat.controller';
import { CpChatService } from './chat.service';
import { CpChatGateway } from './chat.gateway';
import { CpNotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    DatabaseModule, 
    CpGuardsModule, 
    JwtModule.register({}),
    forwardRef(() => CpNotificationsModule)
  ],
  controllers: [CpChatController],
  providers: [CpChatService, CpChatGateway],
  exports: [CpChatService, CpChatGateway],
})
export class CpChatModule {}
