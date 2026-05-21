import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IsceAuthService } from './isce-auth.service';

@Module({
  imports: [HttpModule],
  providers: [IsceAuthService],
  exports: [IsceAuthService],
})
export class IsceAuthModule {}
