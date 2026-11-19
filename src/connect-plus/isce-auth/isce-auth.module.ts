import { Module } from '@nestjs/common';
import { IsceAuthService } from './isce-auth.service';

@Module({
  providers: [IsceAuthService],
  exports: [IsceAuthService],
})
export class IsceAuthModule {}
