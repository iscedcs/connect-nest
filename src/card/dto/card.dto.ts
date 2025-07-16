import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CardDataDto {
  @ApiProperty({ example: 'Senior Developer', description: 'The subtitle of the card' })
  @IsString()
  @IsNotEmpty()
  subTitle: string;

  @ApiProperty({ example: 'Building the future with clean code.', description: 'Short card description' })
  @IsString()
  @IsOptional()
  description?: string;
}

class ImageDto {
  @ApiProperty({
    example: 'https://isce.app/images/profile123.jpg',
    description: 'URL or base64 image string for the profile picture',
  })
  @IsString()
  @IsNotEmpty()
  image: string;
}

class BusinessFieldDto {
  @ApiProperty({ example: 'email', description: 'Type of contact field' })
  @IsString()
  type: string;

  @ApiProperty({ example: 'mail', description: 'Icon class or name' })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiProperty({ example: 'Work Email', description: 'Label for the field' })
  @IsString()
  @IsOptional()
  label?: string;

  @ApiProperty({ example: 'ted@isce.app', description: 'Actual value or content' })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiProperty({ example: 1, description: 'Position/order of the field' })
  position: number;

  @ApiProperty({ example: 'active', description: 'Status of the field' })
  @IsString()
  status: string;
}

export class CreateCardDto {
  @ApiProperty({
    type: CardDataDto,
    description: 'Contains subtitle and description for the card',
  })
  @ValidateNested()
  @Type(() => CardDataDto)
  card: CardDataDto;

  @ApiProperty({
    type: ImageDto,
    description: 'Contains profile image for the card',
  })
  @ValidateNested()
  @Type(() => ImageDto)
  image: ImageDto;

  @ApiProperty({
    example: 'preexisting_card_id_123',
    description: 'Card ID used to update associated CardUrl row',
  })
  @IsString()
  @IsNotEmpty()
  card_id: string;

  @ApiProperty({
    type: [BusinessFieldDto],
    description: 'List of business fields attached to the card',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BusinessFieldDto)
  fields: BusinessFieldDto[];
}



export class SaveCardDto {
  @ApiProperty({ example: 'JOHN', description: 'The title of the card' })
  @IsString()
  @IsNotEmpty()
  @IsString() title: string;

  @ApiProperty({ example: 'Senior Developer', description: 'The subtitle of the card' })
  @IsString()
  @IsNotEmpty()
  subTitle: string;

  @ApiProperty({ example: 'Building the future with clean code.', description: 'Short card description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    type: [BusinessFieldDto],
    description: 'List of business fields attached to the card',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BusinessFieldDto)
  fields: BusinessFieldDto[];
}

export class AddDeviceDto {
  @ApiProperty({ example: 'card_id' })
  @IsString()
  card_id: string;

  @ApiProperty({ example: 'mobile' })
  @IsString()
  type: string;
}


export class ConfirmTokenDto {
  @ApiProperty()
  @IsString()
  card_id: string;

  @ApiProperty()
  @IsString()
  token: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;
}



export class ConfirmCardIdDto {
  @ApiProperty()
  @IsString()
  card_id: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;
}