import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ContactService } from './contact.service';
import {
  ContactController,
  ProfileContactController,
} from './contact.controller';
import { DatabaseModule } from 'src/database/database.module';
import { DatabaseService } from 'src/database/database.service';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [DatabaseModule, HttpModule, NotificationModule],
  controllers: [ContactController, ProfileContactController],
  providers: [ContactService, DatabaseService],
})
export class ContactModule {}
