import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsNumber, Min, IsUrl, IsArray } from 'class-validator';

export class CreateLinkDto {
  @ApiProperty({
    description: 'Title of the link',
    example: 'Official Site'
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'URL of the link (must be HTTPS)',
    example: 'https://example.com'
  })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  url: string;

  @ApiPropertyOptional({
    description: 'Image identifier or icon name',
    example: 'globe'
  })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({
    description: 'Display order',
    example: 1
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({
    description: 'Whether this link is visible',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  is_visible?: boolean;
}

export class UpdateLinkDto {
  @ApiPropertyOptional({
    description: 'Title of the link',
    example: 'Official Site'
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'URL of the link (must be HTTPS)',
    example: 'https://example.com'
  })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  url?: string;

  @ApiPropertyOptional({
    description: 'Image identifier or icon name',
    example: 'globe'
  })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({
    description: 'Display order',
    example: 1
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({
    description: 'Whether this link is visible',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  is_visible?: boolean;
}

export class ReorderLinksDto {
  @ApiProperty({
    description: 'Array of link IDs in the desired order',
    example: ['lnk_a1', 'lnk_b2', 'lnk_c3']
  })
  @IsArray()
  @IsString({ each: true })
  order: string[];
}

export class BulkVisibilityDto {
  @ApiProperty({
    description: 'Array of link IDs',
    example: ['lnk_01', 'lnk_02', 'lnk_07']
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
    description: 'Array of link IDs to delete. If not provided, all links will be deleted.',
    example: ['lnk_01', 'lnk_02']
  })
  @IsOptional()
  @IsString({ each: true })
  ids?: string[];
}

export class BulkRestoreDto {
  @ApiPropertyOptional({
    description: 'Array of link IDs to restore. If not provided, all deleted links will be restored.',
    example: ['lnk_01', 'lnk_02']
  })
  @IsOptional()
  @IsString({ each: true })
  ids?: string[];
}

export class LinkResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the link',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  id: string;

  @ApiProperty({
    description: 'Profile ID this link belongs to',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  profileId: string;

  @ApiProperty({
    description: 'Title of the link',
    example: 'Official Site'
  })
  title: string;

  @ApiProperty({
    description: 'URL of the link',
    example: 'https://example.com'
  })
  url: string;

  @ApiPropertyOptional({
    description: 'Image identifier or icon name',
    example: 'globe'
  })
  image?: string;

  @ApiPropertyOptional({
    description: 'Display order',
    example: 1
  })
  order?: number;

  @ApiProperty({
    description: 'Whether this link is visible',
    example: true
  })
  is_visible: boolean;

  @ApiProperty({
    description: 'Timestamp when the link was created',
    example: '2024-01-01T00:00:00.000Z'
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the link was last updated',
    example: '2024-01-01T00:00:00.000Z'
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Timestamp when the link was deleted (soft delete)',
    example: '2024-01-01T00:00:00.000Z'
  })
  deletedAt?: Date;
}

