import {
  IsObject,
  ValidateNested,
  IsArray,
  IsString,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class TapThemeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() primaryColor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() logoUrl?: string;
}

class TapConfigDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  enabledActions!: string[];

  @ApiPropertyOptional({ type: TapThemeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TapThemeDto)
  theme?: TapThemeDto;
}

export class UpdateCardConfigDto {
  @ApiProperty({ type: TapConfigDto })
  @IsObject()
  @ValidateNested()
  @Type(() => TapConfigDto)
  tapConfig!: TapConfigDto;
}
