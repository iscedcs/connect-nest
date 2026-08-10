import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CpMemberStatus } from '../../../generated/prisma/client';

export class UpdateStaffStatusDto {
  @ApiProperty({ enum: CpMemberStatus })
  @IsEnum(CpMemberStatus)
  status: CpMemberStatus;
}
