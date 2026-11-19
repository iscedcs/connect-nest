import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginateQueryDto } from '../../common/dto/paginate-query.dto';
import { CpMemberStatus } from '../../../generated/prisma/client';

export class ListStaffQueryDto extends PaginateQueryDto {
  @ApiPropertyOptional({ description: 'Matches name, email, job title or department' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: [CpMemberStatus.ACTIVE, CpMemberStatus.SUSPENDED] })
  @IsOptional()
  @IsEnum(CpMemberStatus)
  status?: CpMemberStatus;
}
