import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CpAppointmentsController } from './appointments.controller';
import { CpAppointmentsService } from './appointments.service';

@Module({
  imports: [DatabaseModule],
  controllers: [CpAppointmentsController],
  providers: [CpAppointmentsService],
  exports: [CpAppointmentsService],
})
export class CpAppointmentsModule {}
