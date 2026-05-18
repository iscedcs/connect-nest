import { Module } from '@nestjs/common';
import { ConnectConfigController } from './connect-config.controller';
import { ConnectConfigService } from './connect-config.service';
import { DatabaseModule } from 'src/database/database.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [DatabaseModule, SubscriptionsModule],
  controllers: [ConnectConfigController],
  providers: [ConnectConfigService],
  exports: [ConnectConfigService],
})
export class ConnectConfigModule {}

