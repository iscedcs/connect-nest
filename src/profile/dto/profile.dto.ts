import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsObject,
  IsUUID,
  IsEnum,
  IsBoolean,
  IsNumber,
  Min,
  Max,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateProfileDto {
  @ApiPropertyOptional({
    description: 'URL to the profile photo',
    example: 'https://example.com/profile-photo.jpg',
  })
  @IsOptional()
  @IsString()
  profilePhoto?: string;

  @ApiPropertyOptional({
    description: 'URL to the cover photo',
    example: 'https://example.com/cover-photo.jpg',
  })
  @IsOptional()
  @IsString()
  coverPhoto?: string;

  @ApiProperty({
    description: 'Full name of the person',
    example: 'John Doe',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Professional position or job title',
    example: 'Senior Software Engineer',
  })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({
    description: 'Personal or professional description',
    example:
      'Passionate software engineer with 5+ years of experience in full-stack development.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Location or city',
    example: 'San Francisco, CA',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    description: 'Address information as JSON object',
    example: {
      street: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94105',
      country: 'USA',
    },
  })
  @IsOptional()
  @IsObject()
  address?: object;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description:
      'Unique URL-friendly slug for the profile (3-60 chars, lowercase letters, numbers, hyphens)',
    example: 'john-doe',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, {
    message:
      'Slug must contain only lowercase letters, numbers, and hyphens. Cannot start or end with a hyphen.',
  })
  slug?: string;

  @ApiPropertyOptional({
    description: 'URL to the profile photo',
    example: 'https://example.com/profile-photo.jpg',
  })
  @IsOptional()
  @IsString()
  profilePhoto?: string;

  @ApiPropertyOptional({
    description: 'URL to the cover photo',
    example: 'https://example.com/cover-photo.jpg',
  })
  @IsOptional()
  @IsString()
  coverPhoto?: string;

  @ApiPropertyOptional({
    description: 'Full name of the person',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Professional position or job title',
    example: 'Senior Software Engineer',
  })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({
    description: 'Personal or professional description',
    example:
      'Passionate software engineer with 5+ years of experience in full-stack development.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Location or city',
    example: 'San Francisco, CA',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    description: 'Address information as JSON object',
    example: {
      street: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94105',
      country: 'USA',
    },
  })
  @IsOptional()
  @IsObject()
  address?: object;
}

export class PaginationDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

export class ProfileResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the profile',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    description: 'The unique user ID associated with this profile',
    example: 'user-123',
  })
  @IsString()
  userId: string;

  @ApiPropertyOptional({
    description: 'Unique URL-friendly slug for sharing the profile',
    example: 'john-doe',
  })
  slug?: string;

  @ApiPropertyOptional({
    description: 'URL to the profile photo',
    example: 'https://example.com/profile-photo.jpg',
  })
  profilePhoto?: string;

  @ApiPropertyOptional({
    description: 'URL to the cover photo',
    example: 'https://example.com/cover-photo.jpg',
  })
  coverPhoto?: string;

  @ApiProperty({
    description: 'Full name of the person',
    example: 'John Doe',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Professional position or job title',
    example: 'Senior Software Engineer',
  })
  position?: string;

  @ApiPropertyOptional({
    description: 'Personal or professional description',
    example:
      'Passionate software engineer with 5+ years of experience in full-stack development.',
  })
  description?: string;

  @ApiPropertyOptional({
    description: 'Location or city',
    example: 'San Francisco, CA',
  })
  location?: string;

  @ApiPropertyOptional({
    description: 'Address information as JSON object',
    example: {
      street: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94105',
      country: 'USA',
    },
  })
  address?: object;

  @ApiProperty({
    description: 'Timestamp when the profile was created',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the profile was last updated',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Timestamp when the profile was deleted (soft delete)',
    example: '2024-01-01T00:00:00.000Z',
  })
  deletedAt?: Date;

  @ApiProperty({
    description: 'Whether this is the default profile for the user',
    example: true,
  })
  is_default: boolean;
}

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
}

export class ContactResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the contact',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  id: string;

  @ApiPropertyOptional({
    description: 'First name of the contact',
    example: 'John',
  })
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Last name of the contact',
    example: 'Doe',
  })
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'john.doe@example.com',
  })
  email?: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+1234567890',
  })
  phone?: string;

  @ApiPropertyOptional({
    description: 'Additional notes about the contact',
    example: 'Met at conference, interested in collaboration',
  })
  note?: string;

  @ApiProperty({
    description: 'Timestamp when the contact was created',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the contact was last updated',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;
}

export class NotificationResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the notification',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  id: string;

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
    enum: ['CARD_INTERACTION', 'CONTACT_SHARED'],
  })
  @IsEnum(['CARD_INTERACTION', 'CONTACT_SHARED'])
  type: string;

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
}

export class SupportRequestResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the support request',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    description: 'Subject of the support request',
    example: 'Technical Issue with Profile',
  })
  subject: string;

  @ApiProperty({
    description: 'Detailed message describing the issue',
    example:
      'I am unable to update my profile photo. The upload keeps failing.',
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

export class ProfileStatsResponseDto {
  @ApiProperty({
    description: 'Number of social media accounts',
    example: 5,
  })
  socialsCount: number;

  @ApiProperty({
    description: 'Number of contacts',
    example: 1,
  })
  contactsCount: number;

  @ApiProperty({
    description: 'Number of unread notifications',
    example: 3,
  })
  unreadNotificationsCount: number;

  @ApiProperty({
    description: 'Number of support requests',
    example: 2,
  })
  supportRequestsCount: number;

  @ApiProperty({
    description: 'Number of card interactions',
    example: 15,
  })
  cardInteractionsCount: number;
}

export class CloneProfileDto {
  @ApiPropertyOptional({
    description: 'Resources to include when cloning',
    example: {
      social: true,
      contacts: true,
      links: true,
      videos: true,
      meetings: true,
      appointments: true,
      spotify: true,
      files: true,
      forms: true,
      wallets: true,
      connectConfig: true,
    },
  })
  @IsOptional()
  @IsObject()
  include?: {
    social?: boolean;
    contacts?: boolean;
    links?: boolean;
    videos?: boolean;
    meetings?: boolean;
    appointments?: boolean;
    spotify?: boolean;
    files?: boolean;
    forms?: boolean;
    wallets?: boolean;
    connectConfig?: boolean;
  };

  @ApiPropertyOptional({
    description: 'Custom name for the cloned profile',
    example: 'Cloned Profile - Draft',
  })
  @IsOptional()
  @IsString()
  name?: string;
}
