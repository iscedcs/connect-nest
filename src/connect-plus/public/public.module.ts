import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CpPublicController } from './public.controller';
import { CpPublicService } from './public.service';
import { CpNotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [DatabaseModule, CpNotificationsModule],
  controllers: [CpPublicController],
  providers: [CpPublicService],
})
export class CpPublicModule {}
