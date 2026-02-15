import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScanType } from '../../generated/prisma/client';
import { IsString, IsOptional, IsUUID, IsEnum } from 'class-validator';

export class CreateCardInteractionDto {
  @ApiPropertyOptional({
    description:
      'Profile ID of the user whose card was interacted with. If omitted, resolved from deviceId or slug.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  profileId?: string;

  @ApiPropertyOptional({
    description:
      'Unique identifier of the device that interacted with the card. Required unless slug is provided.',
    example: '29775b12f3d7173e883b38faeb03fa12',
  })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({
    description:
      'Profile slug — used to resolve the profile when no deviceId is available (e.g. QR scans on slug-based profiles).',
    example: 'john-doe',
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({
    description: 'Method of interaction with the card (TAP or SCAN)',
    enum: ScanType,
    example: ScanType.TAP,
  })
  @IsOptional()
  @IsEnum(ScanType)
  method?: ScanType;

  @ApiPropertyOptional({
    description:
      'Type identifier from the device URL (identifies the physical device type)',
    example: '6214bdef7dbcb',
  })
  @IsOptional()
  @IsString()
  deviceType?: string;

  @ApiPropertyOptional({
    description: 'HTTP referrer — where the visitor came from',
    example: 'https://www.google.com',
  })
  @IsOptional()
  @IsString()
  referrer?: string;
}

export class UpdateCardInteractionDto {
  @ApiPropertyOptional({
    description:
      'Unique identifier of the device that interacted with the card',
    example: 'device-12345',
  })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({
    description: 'Method of interaction with the card',
    enum: ScanType,
  })
  @IsOptional()
  @IsEnum(ScanType)
  method?: ScanType;
}

export class CardInteractionResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the card interaction',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    description: 'Profile ID of the user whose card was interacted with',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description:
      'Unique identifier of the device that interacted with the card',
    example: '29775b12f3d7173e883b38faeb03fa12',
  })
  deviceId: string;

  @ApiProperty({
    description: 'Method of interaction with the card',
    enum: ScanType,
  })
  @IsEnum(ScanType)
  method: ScanType;

  @ApiPropertyOptional({
    description: 'Physical device type identifier from URL',
    example: '6214bdef7dbcb',
  })
  @IsOptional()
  @IsString()
  deviceType?: string;

  @ApiPropertyOptional({
    description: 'HTTP referrer',
  })
  @IsOptional()
  @IsString()
  referrer?: string;

  @ApiProperty({
    description: 'Timestamp when the interaction occurred',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the interaction was last updated',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;
}
