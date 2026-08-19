import { Module } from '@nestjs/common';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { DatabaseModule } from 'src/database/database.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [DatabaseModule, SubscriptionsModule],
  controllers: [WalletsController],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class WalletsModule {}

