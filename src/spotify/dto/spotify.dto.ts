import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsNumber, Min, IsUrl } from 'class-validator';

export class CreateSpotifyDto {
  @ApiProperty({ description: 'Spotify item type', example: 'playlist', enum: ['track', 'playlist', 'album', 'artist', 'other'] })
  @IsString()
  type: string;

  @ApiProperty({ description: 'Spotify external URL (must be HTTPS)', example: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M' })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  external_url: string;

  @ApiProperty({ description: 'Title of the Spotify item', example: 'Top Hits' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Whether this item is visible', example: true })
  @IsOptional()
  @IsBoolean()
  is_visible?: boolean;

  @ApiPropertyOptional({ description: 'Display order', example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;
}

export class UpdateSpotifyDto {
  @ApiPropertyOptional({ description: 'Spotify item type', example: 'playlist' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Spotify external URL (must be HTTPS)', example: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M' })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  external_url?: string;

  @ApiPropertyOptional({ description: 'Title of the Spotify item', example: 'Top Hits' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Whether this item is visible', example: true })
  @IsOptional()
  @IsBoolean()
  is_visible?: boolean;

  @ApiPropertyOptional({ description: 'Display order', example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;
}

export class BulkVisibilityDto {
  @ApiProperty({ description: 'Array of Spotify item IDs', example: ['spot_01', 'spot_02'] })
  @IsString({ each: true })
  ids: string[];

  @ApiProperty({ description: 'Visibility status to set', example: true })
  @IsBoolean()
  is_visible: boolean;
}

export class BulkDeleteDto {
  @ApiPropertyOptional({ description: 'Array of Spotify item IDs to delete. If not provided, all items will be deleted.', example: ['spot_01', 'spot_02'] })
  @IsOptional()
  @IsString({ each: true })
  ids?: string[];
}

export class BulkRestoreDto {
  @ApiPropertyOptional({ description: 'Array of Spotify item IDs to restore. If not provided, all deleted items will be restored.', example: ['spot_01', 'spot_02'] })
  @IsOptional()
  @IsString({ each: true })
  ids?: string[];
}

export class SpotifyResponseDto {
  @ApiProperty({ description: 'Unique identifier for the Spotify item', example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ description: 'Profile ID this item belongs to', example: '550e8400-e29b-41d4-a716-446655440000' })
  profileId: string;

  @ApiProperty({ description: 'Spotify item type', example: 'playlist' })
  type: string;

  @ApiProperty({ description: 'Spotify external URL', example: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M' })
  external_url: string;

  @ApiProperty({ description: 'Title of the Spotify item', example: 'Top Hits' })
  title: string;

  @ApiProperty({ description: 'Whether this item is visible', example: true })
  is_visible: boolean;

  @ApiPropertyOptional({ description: 'Display order', example: 1 })
  order?: number;

  @ApiProperty({ description: 'Timestamp when the item was created', example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ description: 'Timestamp when the item was last updated', example: '2024-01-01T00:00:00.000Z' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Timestamp when the item was deleted (soft delete)', example: '2024-01-01T00:00:00.000Z' })
  deletedAt?: Date;
}

