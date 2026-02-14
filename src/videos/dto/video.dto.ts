import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsUrl } from 'class-validator';

export class CreateVideoDto {
  @ApiProperty({
    description: 'Title of the video',
    example: 'Product Onboarding',
  })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Video platform', example: 'youtube' })
  @IsString()
  platform: string;

  @ApiProperty({
    description: 'Video URL (must be HTTPS)',
    example: 'https://youtu.be/abc123',
  })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  url: string;

  @ApiPropertyOptional({
    description: 'Video thumbnail URL',
    example: 'https://img.youtube.com/vi/abc123/maxresdefault.jpg',
  })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  thumbnail?: string;

  @ApiPropertyOptional({
    description: 'Whether this video is visible',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_visible?: boolean;
}

export class UpdateVideoDto {
  @ApiPropertyOptional({
    description: 'Title of the video',
    example: 'Product Onboarding',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Video platform', example: 'youtube' })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional({
    description: 'Video URL (must be HTTPS)',
    example: 'https://youtu.be/abc123',
  })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  url?: string;

  @ApiPropertyOptional({
    description: 'Video thumbnail URL',
    example: 'https://img.youtube.com/vi/abc123/maxresdefault.jpg',
  })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  thumbnail?: string;

  @ApiPropertyOptional({
    description: 'Whether this video is visible',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_visible?: boolean;

  @ApiPropertyOptional({
    description: 'Whether this video is featured',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_featured?: boolean;
}

export {
  BulkVisibilityDto,
  BulkDeleteDto,
  BulkRestoreDto,
} from '../../common/dto/bulk-operations.dto';

export class VideoResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the video',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Profile ID this video belongs to',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  profileId: string;

  @ApiProperty({
    description: 'Title of the video',
    example: 'Product Onboarding',
  })
  title: string;

  @ApiProperty({ description: 'Video platform', example: 'youtube' })
  platform: string;

  @ApiProperty({ description: 'Video URL', example: 'https://youtu.be/abc123' })
  url: string;

  @ApiPropertyOptional({
    description: 'Video thumbnail URL',
    example: 'https://img.youtube.com/vi/abc123/maxresdefault.jpg',
  })
  thumbnail?: string;

  @ApiProperty({
    description: 'Whether this is the featured video',
    example: false,
  })
  is_featured: boolean;

  @ApiProperty({ description: 'Whether this video is visible', example: true })
  is_visible: boolean;

  @ApiProperty({
    description: 'Timestamp when the video was created',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the video was last updated',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Timestamp when the video was deleted (soft delete)',
    example: '2024-01-01T00:00:00.000Z',
  })
  deletedAt?: Date;
}
