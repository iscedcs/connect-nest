import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Module({
  providers: [DatabaseService], // Only DatabaseService here
  exports: [DatabaseService], // Only DatabaseService here
})
export class DatabaseModule {}
