import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InviteClientDto {
  @ApiProperty({ example: 'client@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
