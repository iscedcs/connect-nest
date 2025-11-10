import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsNumber, Min, Max, Matches } from 'class-validator';

export class CreateProfileContactDto {
  @ApiPropertyOptional({
    description: 'Label for the contact (e.g., "Support", "Sales", "Main")',
    example: 'Support'
  })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({
    description: 'Phone number in E.164 format',
    example: '+2348061719944'
  })
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'Phone number must be in E.164 format (e.g., +1234567890)'
  })
  phone_number: string;

  @ApiPropertyOptional({
    description: 'Whether this is the primary contact',
    example: false
  })
  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @ApiPropertyOptional({
    description: 'Whether this contact is visible',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  is_visible?: boolean;
}

export class UpdateProfileContactDto {
  @ApiPropertyOptional({
    description: 'Label for the contact',
    example: 'Support'
  })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({
    description: 'Phone number in E.164 format',
    example: '+2348061719944'
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'Phone number must be in E.164 format (e.g., +1234567890)'
  })
  phone_number?: string;

  @ApiPropertyOptional({
    description: 'Whether this is the primary contact',
    example: false
  })
  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @ApiPropertyOptional({
    description: 'Whether this contact is visible',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  is_visible?: boolean;
}

export class BulkVisibilityDto {
  @ApiProperty({
    description: 'Array of contact IDs',
    example: ['contact_01', 'contact_02', 'contact_07']
  })
  @IsString({ each: true })
  ids: string[];

  @ApiProperty({
    description: 'Visibility status to set',
    example: true
  })
  @IsBoolean()
  is_visible: boolean;
}

export class BulkDeleteDto {
  @ApiPropertyOptional({
    description: 'Array of contact IDs to delete. If not provided, all contacts will be deleted.',
    example: ['contact_01', 'contact_02']
  })
  @IsOptional()
  @IsString({ each: true })
  ids?: string[];
}

export class BulkRestoreDto {
  @ApiPropertyOptional({
    description: 'Array of contact IDs to restore. If not provided, all deleted contacts will be restored.',
    example: ['contact_01', 'contact_02']
  })
  @IsOptional()
  @IsString({ each: true })
  ids?: string[];
}

export class ProfileContactResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the contact',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  id: string;

  @ApiProperty({
    description: 'Profile ID this contact belongs to',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  profileId: string;

  @ApiPropertyOptional({
    description: 'Label for the contact',
    example: 'Support'
  })
  label?: string;

  @ApiProperty({
    description: 'Phone number in E.164 format',
    example: '+2348061719944'
  })
  phone_number: string;

  @ApiProperty({
    description: 'Whether this is the primary contact',
    example: false
  })
  is_primary: boolean;

  @ApiProperty({
    description: 'Whether this contact is visible',
    example: true
  })
  is_visible: boolean;

  @ApiProperty({
    description: 'Timestamp when the contact was created',
    example: '2024-01-01T00:00:00.000Z'
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the contact was last updated',
    example: '2024-01-01T00:00:00.000Z'
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Timestamp when the contact was deleted (soft delete)',
    example: '2024-01-01T00:00:00.000Z'
  })
  deletedAt?: Date;
}

