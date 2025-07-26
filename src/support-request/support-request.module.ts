import { Module } from '@nestjs/common';
import { SupportRequestService } from './support-request.service';
import { SupportRequestController } from './support-request.controller';
import { DatabaseService } from 'src/database/database.service';
import { DatabaseModule } from 'src/database/database.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [DatabaseModule],
  controllers: [SupportRequestController],
  providers: [SupportRequestService],
})
export class SupportRequestModule {}
