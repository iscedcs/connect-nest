import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsUrl } from 'class-validator';

export class CreateMeetingDto {
  @ApiProperty({
    description: 'Meeting provider',
    example: 'meet'
  })
  @IsString()
  provider: string;

  @ApiProperty({
    description: 'Meeting URL (must be HTTPS)',
    example: 'https://meet.google.com/abc-defg-hij'
  })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  url: string;

  @ApiPropertyOptional({
    description: 'Label for the meeting',
    example: 'Google Meet'
  })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({
    description: 'Whether this meeting is visible',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  is_visible?: boolean;
}

export class UpdateMeetingDto {
  @ApiPropertyOptional({
    description: 'Meeting provider',
    example: 'meet'
  })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional({
    description: 'Meeting URL (must be HTTPS)',
    example: 'https://meet.google.com/abc-defg-hij'
  })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  url?: string;

  @ApiPropertyOptional({
    description: 'Label for the meeting',
    example: 'Google Meet'
  })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({
    description: 'Whether this meeting is visible',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  is_visible?: boolean;
}

export class BulkVisibilityDto {
  @ApiProperty({
    description: 'Array of meeting IDs',
    example: ['meet_01', 'meet_02', 'meet_07']
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
    description: 'Array of meeting IDs to delete. If not provided, all meetings will be deleted.',
    example: ['meet_01', 'meet_02']
  })
  @IsOptional()
  @IsString({ each: true })
  ids?: string[];
}

export class BulkRestoreDto {
  @ApiPropertyOptional({
    description: 'Array of meeting IDs to restore. If not provided, all deleted meetings will be restored.',
    example: ['meet_01', 'meet_02']
  })
  @IsOptional()
  @IsString({ each: true })
  ids?: string[];
}

export class MeetingResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the meeting',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  id: string;

  @ApiProperty({
    description: 'Profile ID this meeting belongs to',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  profileId: string;

  @ApiProperty({
    description: 'Meeting provider',
    example: 'meet'
  })
  provider: string;

  @ApiProperty({
    description: 'Meeting URL',
    example: 'https://meet.google.com/abc-defg-hij'
  })
  url: string;

  @ApiPropertyOptional({
    description: 'Label for the meeting',
    example: 'Google Meet'
  })
  label?: string;

  @ApiProperty({
    description: 'Whether this is the default meeting',
    example: false
  })
  is_default: boolean;

  @ApiProperty({
    description: 'Whether this meeting is visible',
    example: true
  })
  is_visible: boolean;

  @ApiProperty({
    description: 'Timestamp when the meeting was created',
    example: '2024-01-01T00:00:00.000Z'
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the meeting was last updated',
    example: '2024-01-01T00:00:00.000Z'
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Timestamp when the meeting was deleted (soft delete)',
    example: '2024-01-01T00:00:00.000Z'
  })
  deletedAt?: Date;
}

