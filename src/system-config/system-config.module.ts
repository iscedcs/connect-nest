import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SystemConfigService } from './system-config.service';
import { SystemConfigController } from './system-config.controller';

@Global()
@Module({
  imports: [DatabaseModule],
  controllers: [SystemConfigController],
  providers: [SystemConfigService],
  exports: [SystemConfigService],
})
export class SystemConfigModule {}
