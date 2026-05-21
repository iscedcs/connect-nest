import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InviteAdminDto {
  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
