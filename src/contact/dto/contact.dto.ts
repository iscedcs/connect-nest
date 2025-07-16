import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class ExchangeContactDto {
  @ApiProperty()
  @IsString()
  card_id: string;

  @ApiProperty()
  @IsString()
  device_type: string;

  @ApiProperty()
  @IsString()
  full_name: string;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    type: Object,
    description: 'Social links as a key-value object',
    example: {
      twitter: 'https://twitter.com/ted_osiobe',
      linkedin: 'https://linkedin.com/in/ted-osiobe',
    },
  })
  @IsOptional()
  socials?: Record<string, string>;
}
