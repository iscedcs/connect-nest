import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDirectConversationDto {
  @ApiProperty()
  @IsString()
  targetAuthUserId!: string;
}
