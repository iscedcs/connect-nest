import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateSupportRequestDto {
  @ApiProperty({
    description: 'Subject/title of the support request',
    example: 'App crashes when scanning QR code',
  })
  @IsString()
  subject: string;

  @ApiProperty({
    description: 'Detailed description of the issue or support needed',
    example:
      'When I try to scan a QR code, the app crashes immediately. This happens on both Android and iOS devices. I have tried reinstalling the app but the issue persists.',
  })
  @IsString()
  message: string;
}

export class UpdateSupportRequestDto {
  @ApiPropertyOptional({
    description: 'Subject/title of the support request',
    example: 'App crashes when scanning QR code',
  })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the issue or support needed',
    example:
      'When I try to scan a QR code, the app crashes immediately. This happens on both Android and iOS devices. I have tried reinstalling the app but the issue persists.',
  })
  @IsOptional()
  @IsString()
  message?: string;
}

export class SupportRequestResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the support request',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    description: 'Profile ID of the user who submitted this support request',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Subject/title of the support request',
    example: 'App crashes when scanning QR code',
  })
  subject: string;

  @ApiProperty({
    description: 'Detailed description of the issue or support needed',
    example:
      'When I try to scan a QR code, the app crashes immediately. This happens on both Android and iOS devices. I have tried reinstalling the app but the issue persists.',
  })
  message: string;

  @ApiProperty({
    description: 'Timestamp when the support request was created',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the support request was last updated',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;
}
