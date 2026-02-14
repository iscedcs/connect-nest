import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateSocialDto {
  @ApiProperty({
    description: 'Social media platform name',
    example: 'LinkedIn',
  })
  @IsString()
  platform: string;

  @ApiPropertyOptional({
    description: 'Custom label for the social media link',
    example: 'Professional Profile',
  })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({
    description: 'Social media profile URL or handle',
    example: 'https://linkedin.com/in/johndoe',
  })
  @IsString()
  value: string;

  @ApiPropertyOptional({
    description: 'Whether this social is visible',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_visible?: boolean;

  @ApiPropertyOptional({ description: 'Display order', example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;
}

export class UpdateSocialDto {
  @ApiPropertyOptional({
    description: 'Social media platform name',
    example: 'LinkedIn',
  })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional({
    description: 'Custom label for the social media link',
    example: 'Professional Profile',
  })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({
    description: 'Social media profile URL or handle',
    example: 'https://linkedin.com/in/johndoe',
  })
  @IsOptional()
  @IsString()
  value?: string;

  @ApiPropertyOptional({
    description: 'Whether this social is visible',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_visible?: boolean;

  @ApiPropertyOptional({ description: 'Display order', example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;
}

export {
  BulkVisibilityDto,
  BulkDeleteDto,
  BulkRestoreDto,
} from '../../common/dto/bulk-operations.dto';

export class SocialResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the social media entry',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    description: 'Social media platform name',
    example: 'LinkedIn',
  })
  platform: string;

  @ApiPropertyOptional({
    description: 'Custom label for the social media link',
    example: 'Professional Profile',
  })
  label?: string;

  @ApiProperty({
    description: 'Social media profile URL or handle',
    example: 'https://linkedin.com/in/johndoe',
  })
  value: string;

  @ApiProperty({
    description: 'Timestamp when the social media was created',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the social media was last updated',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;

  @ApiProperty({ description: 'Whether this social is visible', example: true })
  is_visible: boolean;

  @ApiPropertyOptional({ description: 'Display order', example: 1 })
  order?: number;

  @ApiPropertyOptional({
    description: 'Timestamp when the social media was deleted (soft delete)',
    example: '2024-01-01T00:00:00.000Z',
  })
  deletedAt?: Date;
}
