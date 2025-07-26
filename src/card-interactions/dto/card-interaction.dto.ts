import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScanType } from '@prisma/client';
import { IsString, IsOptional, IsUUID, IsEnum } from 'class-validator';

export class CreateCardInteractionDto {
  @ApiProperty({
    description: 'Profile ID of the user whose card was interacted with',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @IsUUID()
  profileId: string;

  @ApiProperty({
    description: 'Unique identifier of the device that interacted with the card',
    example: 'device-12345'
  })
  @IsString()
  deviceId: string;

  @ApiProperty({
    description: 'Method of interaction with the card',
    enum: ScanType,
    example: ScanType.TAP
  })
  @IsEnum(ScanType)
  method: ScanType;
}

export class UpdateCardInteractionDto {
  @ApiPropertyOptional({
    description: 'Unique identifier of the device that interacted with the card',
    example: 'device-12345'
  })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({
    description: 'Method of interaction with the card',
    enum: ScanType
  })
  @IsOptional()
  @IsEnum(ScanType)
  method?: ScanType;
}

export class CardInteractionResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the card interaction',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    description: 'Profile ID of the user whose card was interacted with',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Unique identifier of the device that interacted with the card',
    example: 'device-12345'
  })
  deviceId: string;

  @ApiProperty({
    description: 'Method of interaction with the card',
    enum: ScanType
  })
  @IsEnum(ScanType)
  method: ScanType;

  @ApiProperty({
    description: 'Timestamp when the interaction occurred',
    example: '2024-01-01T00:00:00.000Z'
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the interaction was last updated',
    example: '2024-01-01T00:00:00.000Z'
  })
  updatedAt: Date;
}
