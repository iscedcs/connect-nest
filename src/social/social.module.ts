import { Module } from '@nestjs/common';
import { SocialService } from './social.service';
import { SocialController, ProfileSocialController } from './social.controller';
import { DatabaseModule } from 'src/database/database.module';
import { DatabaseService } from 'src/database/database.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SocialController, ProfileSocialController],
  providers: [SocialService, DatabaseService],
})
export class SocialModule {}
