import { Module } from '@nestjs/common';
import { ContactService } from './contact.service';
import { ContactController } from './contact.controller';
import { DatabaseService } from 'src/database/database.service';

@Module({
  controllers: [ContactController],
  providers: [ContactService, DatabaseService],
})
export class ContactModule {}
