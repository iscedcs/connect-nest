import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  IsUrl,
} from 'class-validator';

export class CreateFileDto {
  @ApiProperty({ description: 'Original filename', example: 'brochure.pdf' })
  @IsString()
  filename: string;

  @ApiProperty({
    description: 'Storage key/path in Digital Ocean Spaces',
    example: 'profiles/prof_01/files/brochure_1729890610.pdf',
  })
  @IsString()
  storage_key: string;

  @ApiProperty({ description: 'Media/MIME type', example: 'application/pdf' })
  @IsString()
  media_type: string;

  @ApiProperty({ description: 'File size in bytes', example: 482193 })
  @IsNumber()
  @Min(0)
  size_bytes: number;

  @ApiPropertyOptional({
    description: 'File checksum (e.g., sha256:abcdef1234567890)',
    example: 'sha256:abcdef1234567890',
  })
  @IsOptional()
  @IsString()
  checksum?: string;

  @ApiProperty({
    description: 'Public URL to the file in Digital Ocean Spaces',
    example:
      'https://connect-files.nyc3.digitaloceanspaces.com/profiles/prof_01/files/brochure_1729890610.pdf',
  })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  spaces_url: string;

  @ApiPropertyOptional({
    description: 'Whether this file is visible',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_visible?: boolean;
}

export class UpdateFileDto {
  @ApiPropertyOptional({
    description: 'Original filename',
    example: 'brochure.pdf',
  })
  @IsOptional()
  @IsString()
  filename?: string;

  @ApiPropertyOptional({
    description: 'Whether this file is visible',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_visible?: boolean;
}

export {
  BulkVisibilityDto,
  BulkDeleteDto,
  BulkRestoreDto,
} from '../../common/dto/bulk-operations.dto';

export class FileResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the file',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Profile ID this file belongs to',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  profileId: string;

  @ApiProperty({ description: 'Original filename', example: 'brochure.pdf' })
  filename: string;

  @ApiProperty({
    description: 'Storage key/path in Digital Ocean Spaces',
    example: 'profiles/prof_01/files/brochure_1729890610.pdf',
  })
  storage_key: string;

  @ApiProperty({ description: 'Media/MIME type', example: 'application/pdf' })
  media_type: string;

  @ApiProperty({ description: 'File size in bytes', example: 482193 })
  size_bytes: number;

  @ApiPropertyOptional({
    description: 'File checksum',
    example: 'sha256:abcdef1234567890',
  })
  checksum?: string;

  @ApiProperty({
    description: 'Public URL to the file in Digital Ocean Spaces',
    example:
      'https://connect-files.nyc3.digitaloceanspaces.com/profiles/prof_01/files/brochure_1729890610.pdf',
  })
  spaces_url: string;

  @ApiProperty({ description: 'Whether this file is visible', example: true })
  is_visible: boolean;

  @ApiProperty({
    description: 'Timestamp when the file was created',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the file was last updated',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Timestamp when the file was deleted (soft delete)',
    example: '2024-01-01T00:00:00.000Z',
  })
  deletedAt?: Date;
}

export class DownloadResponseDto {
  @ApiProperty({
    description: 'Time-limited download URL',
    example:
      'https://connect-files.nyc3.digitaloceanspaces.com/profiles/prof_01/files/brochure_1729890610.pdf?X-Amz-Algorithm=...',
  })
  download_url: string;

  @ApiProperty({
    description: 'URL expiration timestamp',
    example: '2024-01-01T17:00:00.000Z',
  })
  expires_at: string;
}
