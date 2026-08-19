import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { ProfileController, ProfilesController } from './profile.controller';
import { DatabaseModule } from 'src/database/database.module';
import { DatabaseService } from 'src/database/database.service';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [DatabaseModule, AuthModule, SubscriptionsModule],
  controllers: [ProfileController, ProfilesController],
  providers: [ProfileService, DatabaseService],
})
export class ProfileModule {}
