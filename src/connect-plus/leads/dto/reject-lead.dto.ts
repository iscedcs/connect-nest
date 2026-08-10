import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RejectLeadDto {
  @ApiPropertyOptional({ description: 'Rejection reason' })
  @IsString()
  @IsOptional()
  reason?: string;
}
