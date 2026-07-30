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

export class AddressDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  street?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  zip?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  country?: string;
}

export class BrandingDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, { message: 'Must be a valid hex color' })
  primaryColor?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, { message: 'Must be a valid hex color' })
  secondaryColor?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  fontFamily?: string;
}

export class AppointmentDefaultsDto {
  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(1)
  duration?: number; // minutes

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
  gracePeriod?: number; // minutes
}

export class BankDetailsDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  bankName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  accountName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  accountNumber?: string;
}

export class InvoiceDefaultsDto {
  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
  dueDays?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ type: () => BankDetailsDto })
  @ValidateNested()
  @Type(() => BankDetailsDto)
  @IsOptional()
  bankDetails?: BankDetailsDto;
}

export class NotificationPrefsDto {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  emailEnabled?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  smsEnabled?: boolean;
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
  coverImage?: string;

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

  @ApiPropertyOptional({ type: () => AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  @IsOptional()
  address?: AddressDto;

  @ApiPropertyOptional({ type: () => [BusinessHourEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BusinessHourEntryDto)
  @IsOptional()
  businessHours?: BusinessHourEntryDto[];

  @ApiPropertyOptional({ type: () => BrandingDto })
  @ValidateNested()
  @Type(() => BrandingDto)
  @IsOptional()
  branding?: BrandingDto;

  @ApiPropertyOptional({ type: () => AppointmentDefaultsDto })
  @ValidateNested()
  @Type(() => AppointmentDefaultsDto)
  @IsOptional()
  appointmentDefaults?: AppointmentDefaultsDto;

  @ApiPropertyOptional({ type: () => InvoiceDefaultsDto })
  @ValidateNested()
  @Type(() => InvoiceDefaultsDto)
  @IsOptional()
  invoiceDefaults?: InvoiceDefaultsDto;

  @ApiPropertyOptional({ type: () => NotificationPrefsDto })
  @ValidateNested()
  @Type(() => NotificationPrefsDto)
  @IsOptional()
  notificationPrefs?: NotificationPrefsDto;
}
