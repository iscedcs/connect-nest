import { Global, Module } from '@nestjs/common';
import { MailClientService } from './mail-client.service';

@Global()
@Module({
  providers: [MailClientService],
  exports: [MailClientService],
})
export class MailClientModule {}
