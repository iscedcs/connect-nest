import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import {
  ArtisanController,
  DirectoryController,
  ArtisanAdminController,
} from './artisan.controller';
import { ArtisanService } from './artisan.service';
import { DatabaseService } from '../database/database.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ArtisanController, DirectoryController, ArtisanAdminController],
  providers: [ArtisanService, DatabaseService],
  exports: [ArtisanService],
})
export class ArtisanModule {}
