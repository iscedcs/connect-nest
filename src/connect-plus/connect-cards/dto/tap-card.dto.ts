import { IsOptional, IsString, IsEmail } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TapCardDto {
  @ApiPropertyOptional() @IsOptional() @IsString() visitorName?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() visitorEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() visitorPhone?: string;
}
