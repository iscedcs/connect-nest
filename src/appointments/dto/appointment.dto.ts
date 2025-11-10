import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsUrl } from 'class-validator';

export class CreateAppointmentDto {
  @ApiProperty({ description: 'Appointment provider', example: 'calendly' })
  @IsString()
  provider: string;

  @ApiProperty({ description: 'Appointment URL (must be HTTPS)', example: 'https://calendly.com/brand/intro-call' })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  url: string;

  @ApiPropertyOptional({ description: 'Label for the appointment', example: 'Intro Call' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ description: 'Whether this appointment is visible', example: true })
  @IsOptional()
  @IsBoolean()
  is_visible?: boolean;
}

export class UpdateAppointmentDto {
  @ApiPropertyOptional({ description: 'Appointment provider', example: 'calendly' })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional({ description: 'Appointment URL (must be HTTPS)', example: 'https://calendly.com/brand/intro-call' })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  url?: string;

  @ApiPropertyOptional({ description: 'Label for the appointment', example: 'Intro Call' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ description: 'Whether this appointment is visible', example: true })
  @IsOptional()
  @IsBoolean()
  is_visible?: boolean;
}

export class BulkVisibilityDto {
  @ApiProperty({ description: 'Array of appointment IDs', example: ['apt_01', 'apt_02'] })
  @IsString({ each: true })
  ids: string[];

  @ApiProperty({ description: 'Visibility status to set', example: true })
  @IsBoolean()
  is_visible: boolean;
}

export class BulkDeleteDto {
  @ApiPropertyOptional({ description: 'Array of appointment IDs to delete. If not provided, all appointments will be deleted.', example: ['apt_01', 'apt_02'] })
  @IsOptional()
  @IsString({ each: true })
  ids?: string[];
}

export class BulkRestoreDto {
  @ApiPropertyOptional({ description: 'Array of appointment IDs to restore. If not provided, all deleted appointments will be restored.', example: ['apt_01', 'apt_02'] })
  @IsOptional()
  @IsString({ each: true })
  ids?: string[];
}

export class AppointmentResponseDto {
  @ApiProperty({ description: 'Unique identifier for the appointment', example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ description: 'Profile ID this appointment belongs to', example: '550e8400-e29b-41d4-a716-446655440000' })
  profileId: string;

  @ApiProperty({ description: 'Appointment provider', example: 'calendly' })
  provider: string;

  @ApiProperty({ description: 'Appointment URL', example: 'https://calendly.com/brand/intro-call' })
  url: string;

  @ApiPropertyOptional({ description: 'Label for the appointment', example: 'Intro Call' })
  label?: string;

  @ApiProperty({ description: 'Whether this is the default appointment', example: false })
  is_default: boolean;

  @ApiProperty({ description: 'Whether this appointment is visible', example: true })
  is_visible: boolean;

  @ApiProperty({ description: 'Timestamp when the appointment was created', example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ description: 'Timestamp when the appointment was last updated', example: '2024-01-01T00:00:00.000Z' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Timestamp when the appointment was deleted (soft delete)', example: '2024-01-01T00:00:00.000Z' })
  deletedAt?: Date;
}

