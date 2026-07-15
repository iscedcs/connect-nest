import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CpRole } from '../../../generated/prisma/client';

export class UpdateStaffRoleDto {
  @ApiProperty({ enum: [CpRole.WORKSPACE_ADMIN, CpRole.STAFF] })
  @IsIn([CpRole.WORKSPACE_ADMIN, CpRole.STAFF])
  role: CpRole;
}
