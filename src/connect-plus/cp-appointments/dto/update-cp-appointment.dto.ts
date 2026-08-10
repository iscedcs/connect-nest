import { PartialType } from '@nestjs/swagger';
import { CreateAppointmentDto } from './create-cp-appointment.dto';

export class UpdateCpAppointmentDto extends PartialType(CreateAppointmentDto) {}
