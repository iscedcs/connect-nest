import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import {
  ArtisanController,
  DirectoryController,
  ArtisanAdminController,
} from './artisan.controller';
import { ThreadController } from './thread.controller';
import { ArtisanService } from './artisan.service';
import { ThreadService } from './thread.service';
import { ThreadEventService } from './thread-event.service';
import { ThreadGateway } from './thread.gateway';
import { DatabaseService } from '../database/database.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [
    ArtisanController,
    DirectoryController,
    ArtisanAdminController,
    ThreadController,
  ],
  providers: [
    ArtisanService,
    ThreadService,
    ThreadEventService,
    ThreadGateway,
    DatabaseService,
  ],
  exports: [ArtisanService, ThreadService, ThreadEventService],
})
export class ArtisanModule {}
