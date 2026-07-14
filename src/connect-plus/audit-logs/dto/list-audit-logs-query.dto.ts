import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { PaginateQueryDto } from '../../common/dto/paginate-query.dto';

export class ListAuditLogsQueryDto extends PaginateQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by target entity name (e.g. Invoice, Client)',
  })
  @IsOptional()
  @IsString()
  entity?: string;

  @ApiPropertyOptional({ description: 'Filter by target entity ID' })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional({
    description: 'Filter by event type (e.g. INVOICE_CREATED)',
  })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional({ description: 'Filter by actor user ID' })
  @IsOptional()
  @IsString()
  actorId?: string;

  @ApiPropertyOptional({ description: 'Start of date range (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'End of date range (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
