import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CpLeadStatus, CpLeadSource } from '../../../generated/prisma/client';
import { PaginateQueryDto } from '../../common/dto/paginate-query.dto';

export class ListLeadsQueryDto extends PaginateQueryDto {
  @ApiPropertyOptional({ enum: CpLeadStatus })
  @IsEnum(CpLeadStatus)
  @IsOptional()
  status?: CpLeadStatus;

  @ApiPropertyOptional({ enum: CpLeadSource })
  @IsEnum(CpLeadSource)
  @IsOptional()
  source?: CpLeadSource;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  assignedStaffId?: string;
}
