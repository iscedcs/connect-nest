import { IsOptional, IsObject, IsNumber } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CheckOutDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  locationData?: { lat?: number; lng?: number; accuracy?: number };
}
