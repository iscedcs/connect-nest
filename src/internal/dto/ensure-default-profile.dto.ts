import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EnsureDefaultProfileDto {
  @ApiProperty({ description: 'isce-auth user id' })
  @IsString()
  @IsNotEmpty()
  authUserId: string;

  @ApiProperty({ description: 'Full name from isce-auth signup' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Profile photo URL from isce-auth signup',
  })
  @IsOptional()
  @IsString()
  profilePhoto?: string;
}
