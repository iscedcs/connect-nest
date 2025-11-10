import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ModuleConfigDto {
  @ApiProperty({ description: 'Module ID', example: 'mod_links' })
  id: string;

  @ApiProperty({ description: 'Module type', example: 'links' })
  type: string;

  @ApiPropertyOptional({ description: 'Whether module is enabled', example: true })
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Display order', example: 1 })
  order?: number;

  @ApiPropertyOptional({ description: 'Visibility level', example: 'public' })
  visibility?: string;

  @ApiPropertyOptional({ description: 'Module settings', example: { max_items: 10, layout: 'list' } })
  settings?: any;
}

export class UpdateConnectConfigDto {
  @ApiPropertyOptional({ description: 'Module configurations', type: [ModuleConfigDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModuleConfigDto)
  modules?: ModuleConfigDto[];

  @ApiPropertyOptional({ description: 'Theme configuration', example: { mode: 'dark', primary: '#0EA5E9', accent: '#F59E0B' } })
  @IsOptional()
  @IsObject()
  theme?: any;

  @ApiPropertyOptional({ description: 'Branding configuration', example: { avatar_url: 'https://cdn.example.com/p/avatar.png', hero_image_url: 'https://cdn.example.com/p/hero.png', headline: 'Welcome', subheadline: 'All my links' } })
  @IsOptional()
  @IsObject()
  branding?: any;
}

export class ReorderModulesDto {
  @ApiProperty({ description: 'Array of module IDs in desired order', example: ['mod_links', 'mod_videos', 'mod_social'] })
  @IsArray()
  module_ids: string[];
}

export class ConnectConfigResponseDto {
  @ApiProperty({ description: 'Unique identifier for the config', example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ description: 'Profile ID this config belongs to', example: '550e8400-e29b-41d4-a716-446655440000' })
  profileId: string;

  @ApiProperty({ description: 'Module configurations (JSON)', type: 'object', additionalProperties: true })
  modules: any;

  @ApiProperty({ description: 'Theme configuration (JSON)', type: 'object', additionalProperties: true })
  theme: any;

  @ApiProperty({ description: 'Branding configuration (JSON)', type: 'object', additionalProperties: true })
  branding: any;

  @ApiProperty({ description: 'Timestamp when the config was created', example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ description: 'Timestamp when the config was last updated', example: '2024-01-01T00:00:00.000Z' })
  updatedAt: Date;
}

