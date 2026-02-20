import { Global, Module } from '@nestjs/common';
import { PushService } from './push.service';
import { AuthModule } from 'src/auth/auth.module';

@Global()
@Module({
  imports: [AuthModule],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
