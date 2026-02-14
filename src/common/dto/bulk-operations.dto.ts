import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class BulkVisibilityDto {
  @ApiProperty({
    description: 'Array of item IDs',
    example: ['id_01', 'id_02'],
  })
  @IsString({ each: true })
  ids: string[];

  @ApiProperty({ description: 'Visibility status to set', example: true })
  @IsBoolean()
  is_visible: boolean;
}

export class BulkDeleteDto {
  @ApiPropertyOptional({
    description:
      'Array of item IDs to delete. If not provided, all items will be deleted.',
    example: ['id_01', 'id_02'],
  })
  @IsOptional()
  @IsString({ each: true })
  ids?: string[];
}

export class BulkRestoreDto {
  @ApiPropertyOptional({
    description:
      'Array of item IDs to restore. If not provided, all deleted items will be restored.',
    example: ['id_01', 'id_02'],
  })
  @IsOptional()
  @IsString({ each: true })
  ids?: string[];
}
