import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CpWorkspaceStatus } from '../../../generated/prisma/client';

export class UpdateWorkspaceStatusDto {
  @ApiProperty({ enum: CpWorkspaceStatus })
  @IsEnum(CpWorkspaceStatus)
  status: CpWorkspaceStatus;
}
