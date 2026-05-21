import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CpRole } from '../../../generated/prisma/client';

export class UpdateStaffRoleDto {
  @ApiProperty({ enum: CpRole })
  @IsEnum(CpRole)
  role: CpRole;
}
