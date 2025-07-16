import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString, Length } from "class-validator";

export class AuthDto {
    @ApiProperty({
        description: 'The user email',
        example: 'tedosiobe@gmail.com',
    })
    @IsNotEmpty()
    @IsString()
    @IsEmail()
    public email: string;


    @ApiProperty({
        description: 'The user password',
        example: 'password',
    })
    @IsNotEmpty()
    @IsString()
    @Length(3, 20, { message: 'Password has to be between 3 and 20 chars long' })
    public password: string;
}