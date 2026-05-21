import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CpPublicController } from './public.controller';
import { CpPublicService } from './public.service';

@Module({
  imports: [DatabaseModule],
  controllers: [CpPublicController],
  providers: [CpPublicService],
})
export class CpPublicModule {}
