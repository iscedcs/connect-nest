import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { InternalController } from './internal.controller';
import { InternalGuard } from './internal.guard';
import { InternalService } from './internal.service';

@Module({
  imports: [DatabaseModule],
  controllers: [InternalController],
  providers: [InternalService, InternalGuard],
})
export class InternalModule {}
