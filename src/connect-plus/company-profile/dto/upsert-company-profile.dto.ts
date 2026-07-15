import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsEmail,
  IsPhoneNumber,
  IsArray,
  ValidateNested,
  IsNumber,
  IsBoolean,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BusinessHourEntryDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(6)
  day: number;

  @ApiProperty()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'Must be HH:mm' })
  open: string;

  @ApiProperty()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'Must be HH:mm' })
  close: string;

  @ApiProperty()
  @IsBoolean()
  isOpen: boolean;
}

export class UpsertCompanyProfileDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  logo?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  address?: Record<string, unknown>;

  @ApiPropertyOptional({ type: () => [BusinessHourEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BusinessHourEntryDto)
  @IsOptional()
  businessHours?: BusinessHourEntryDto[];

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  branding?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  appointmentDefaults?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  invoiceDefaults?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  notificationPrefs?: Record<string, unknown>;
}
