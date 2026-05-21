import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';
import { CpInvoiceStatus } from '../../../generated/prisma/client';
import { PaginateQueryDto } from '../../common/dto/paginate-query.dto';

export class ListInvoicesQueryDto extends PaginateQueryDto {
  @ApiPropertyOptional({ enum: CpInvoiceStatus })
  @IsOptional()
  @IsEnum(CpInvoiceStatus)
  status?: CpInvoiceStatus;
}
