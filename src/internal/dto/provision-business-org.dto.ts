import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ProvisionBusinessOrgDto {
  @ApiProperty({ description: 'isce-auth user id of the business owner' })
  @IsString()
  @IsNotEmpty()
  authUserId: string;

  @ApiProperty({ description: 'Business name from isce-auth signup' })
  @IsString()
  @IsNotEmpty()
  businessName: string;
}
