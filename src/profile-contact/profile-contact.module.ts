import { Module } from '@nestjs/common';
import { ProfileContactController } from './profile-contact.controller';
import { ProfileContactService } from './profile-contact.service';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ProfileContactController],
  providers: [ProfileContactService],
  exports: [ProfileContactService],
})
export class ProfileContactModule {}
