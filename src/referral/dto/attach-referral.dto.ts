import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AttachReferralDto {
  @ApiProperty({
    description: 'The ISCE Tag (referral code / username) of the referrer. Case-insensitive; may include a leading @.',
    example: 'ada',
  })
  @IsString()
  @IsNotEmpty()
  referralUsername: string;
}
