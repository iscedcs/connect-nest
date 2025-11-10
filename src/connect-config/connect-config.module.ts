import { Module } from '@nestjs/common';
import { ConnectConfigController } from './connect-config.controller';
import { ConnectConfigService } from './connect-config.service';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ConnectConfigController],
  providers: [ConnectConfigService],
  exports: [ConnectConfigService],
})
export class ConnectConfigModule {}

