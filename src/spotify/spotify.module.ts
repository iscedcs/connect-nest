import { Module } from '@nestjs/common';
import { SpotifyController } from './spotify.controller';
import { SpotifyService } from './spotify.service';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [SpotifyController],
  providers: [SpotifyService],
  exports: [SpotifyService],
})
export class SpotifyModule {}
