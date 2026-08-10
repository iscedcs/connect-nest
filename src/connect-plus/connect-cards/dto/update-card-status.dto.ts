import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CpCardStatus } from '../../../generated/prisma/client';

export class UpdateCardStatusDto {
  @ApiProperty({ enum: CpCardStatus })
  @IsEnum(CpCardStatus)
  status!: CpCardStatus;
}
