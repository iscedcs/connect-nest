import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsEmail } from 'class-validator';

export class CreateContactDto {
  @ApiProperty({
    description: 'Profile ID of the user receiving the contact',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @IsUUID()
  profileId: string;

  @ApiPropertyOptional({
    description: 'First name of the guest leaving contact',
    example: 'John'
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Last name of the guest leaving contact',
    example: 'Doe'
  })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Email address of the guest',
    example: 'john.doe@example.com'
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Phone number of the guest',
    example: '+1234567890'
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Additional message or note from the guest',
    example: 'Interested in collaboration, met at the conference'
  })
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateContactDto {
  @ApiPropertyOptional({
    description: 'First name of the guest',
    example: 'John'
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Last name of the guest',
    example: 'Doe'
  })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Email address of the guest',
    example: 'john.doe@example.com'
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Phone number of the guest',
    example: '+1234567890'
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Additional message or note from the guest',
    example: 'Interested in collaboration, met at the conference'
  })
  @IsOptional()
  @IsString()
  note?: string;
}

export class ContactResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the contact',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    description: 'Profile ID of the user who received this contact',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @IsUUID()
  ownerId: string;

  @ApiPropertyOptional({
    description: 'First name of the guest',
    example: 'John'
  })
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Last name of the guest',
    example: 'Doe'
  })
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Email address of the guest',
    example: 'john.doe@example.com'
  })
  email?: string;

  @ApiPropertyOptional({
    description: 'Phone number of the guest',
    example: '+1234567890'
  })
  phone?: string;

  @ApiPropertyOptional({
    description: 'Additional message or note from the guest',
    example: 'Interested in collaboration, met at the conference'
  })
  note?: string;

  @ApiProperty({
    description: 'Timestamp when the contact was created',
    example: '2024-01-01T00:00:00.000Z'
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the contact was last updated',
    example: '2024-01-01T00:00:00.000Z'
  })
  updatedAt: Date;
}
