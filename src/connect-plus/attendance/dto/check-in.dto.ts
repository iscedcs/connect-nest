import { IsOptional, IsObject, IsNumber } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class LocationDataDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber() lat?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() lng?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() accuracy?: number;
}

export class CheckInDto {
  @ApiPropertyOptional({ type: LocationDataDto })
  @IsOptional()
  @IsObject()
  locationData?: LocationDataDto;
}
