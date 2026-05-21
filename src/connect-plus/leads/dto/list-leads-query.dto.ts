import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CpLeadStatus } from '../../../generated/prisma/client';

export class ListLeadsQueryDto {
  @ApiPropertyOptional({ enum: CpLeadStatus })
  @IsEnum(CpLeadStatus)
  @IsOptional()
  status?: CpLeadStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  page?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  limit?: string;
}
