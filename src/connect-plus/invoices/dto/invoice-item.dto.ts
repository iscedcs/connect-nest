import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumberString, IsString, MinLength } from 'class-validator';

export class InvoiceItemDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiProperty({ example: '2' })
  @IsNumberString()
  quantity!: string;

  @ApiProperty({ example: '25000' })
  @IsNumberString()
  unitPrice!: string;
}
