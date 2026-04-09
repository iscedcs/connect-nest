import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LinkDeviceDto {
  @ApiProperty({ description: 'Device product ID (from isce-auth)' })
  @IsString()
  @IsNotEmpty()
  deviceId: string;
}

export class UnlinkDeviceDto {
  @ApiProperty({ description: 'Device product ID to unlink' })
  @IsString()
  @IsNotEmpty()
  deviceId: string;
}

export class DeviceProfileResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() deviceId: string;
  @ApiProperty() profileId: string;
  @ApiPropertyOptional() linkedAt: Date;
}

export class AdminReassignDeviceDto {
  @ApiProperty({ description: 'Device product ID to reassign' })
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @ApiProperty({ description: 'Target profile ID to assign the device to' })
  @IsString()
  @IsNotEmpty()
  newProfileId: string;
}

export class AdminUnlinkDeviceDto {
  @ApiProperty({ description: 'Device product ID to unlink' })
  @IsString()
  @IsNotEmpty()
  deviceId: string;
}
