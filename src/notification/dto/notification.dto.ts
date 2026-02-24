import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '../../generated/prisma/client';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsBoolean,
} from 'class-validator';

export class CreateNotificationDto {
  @ApiProperty({
    description: 'Profile ID of the user receiving the notification',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  profileId: string;

  @ApiProperty({
    description: 'Title of the notification',
    example: 'New Card Interaction',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Message content of the notification',
    example: 'Someone tapped your business card',
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Type of notification',
    enum: NotificationType,
    example: NotificationType.CARD_INTERACTION,
  })
  @IsEnum(NotificationType)
  type: NotificationType;
}

export class UpdateNotificationDto {
  @ApiPropertyOptional({
    description: 'Title of the notification',
    example: 'New Card Interaction',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Message content of the notification',
    example: 'Someone tapped your business card',
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({
    description: 'Type of notification',
    enum: NotificationType,
  })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @ApiPropertyOptional({
    description: 'Whether the notification has been read',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;
}

export class NotificationResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the notification',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    description: 'Profile ID of the user who received this notification',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Title of the notification',
    example: 'New Card Interaction',
  })
  title: string;

  @ApiProperty({
    description: 'Message content of the notification',
    example: 'Someone tapped your business card',
  })
  message: string;

  @ApiProperty({
    description: 'Type of notification',
    enum: NotificationType,
  })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({
    description: 'Whether the notification has been read',
    example: false,
  })
  @IsBoolean()
  isRead: boolean;

  @ApiProperty({
    description: 'Timestamp when the notification was created',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the notification was last updated',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;
}
