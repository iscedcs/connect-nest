import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class MarkInvoicePaidDto {
  @ApiPropertyOptional({ description: 'cash | bank_transfer | paystack' })
  @IsOptional()
  @IsString()
  paidVia?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalRef?: string;
}
