import { IsString, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ description: 'Message text content' })
  @IsString()
  content: string;

  @ApiPropertyOptional({
    description: 'Optional file attachments',
    type: 'array',
    items: { type: 'object' },
  })
  @IsOptional()
  @IsArray()
  attachments?: Array<{
    url: string;
    name: string;
    type: string;
    size: number;
  }>;
}
