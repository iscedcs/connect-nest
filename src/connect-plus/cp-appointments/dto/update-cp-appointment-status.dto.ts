import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CpAppointmentStatus } from '../../../generated/prisma/client';

export class UpdateCpAppointmentStatusDto {
  @ApiProperty({ enum: CpAppointmentStatus })
  @IsEnum(CpAppointmentStatus)
  status: CpAppointmentStatus;
}
