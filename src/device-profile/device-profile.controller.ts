import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Request,
  Param,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { DeviceProfileService } from './device-profile.service';
import {
  LinkDeviceDto,
  DeviceProfileResponseDto,
} from './dto/device-profile.dto';

@ApiTags('Device Profiles')
@ApiBearerAuth('access-token')
@Controller('profiles/:profileId/devices')
export class DeviceProfileController {
  constructor(private readonly deviceProfileService: DeviceProfileService) {}

  @Post('link')
  @ApiOperation({ summary: 'Link a device to a profile' })
  @ApiResponse({
    status: 201,
    description: 'Device linked successfully',
    type: DeviceProfileResponseDto,
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: LinkDeviceDto })
  linkDevice(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: LinkDeviceDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.deviceProfileService.linkDevice(user, profileId, dto.deviceId);
  }

  @Delete('unlink/:deviceId')
  @ApiOperation({ summary: 'Unlink a device from a profile' })
  @ApiResponse({ status: 200, description: 'Device unlinked successfully' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'deviceId', description: 'Device product ID' })
  unlinkDevice(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('deviceId') deviceId: string,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.deviceProfileService.unlinkDevice(user, profileId, deviceId);
  }

  @Get('all')
  @ApiOperation({ summary: 'List all devices linked to a profile' })
  @ApiResponse({
    status: 200,
    description: 'Devices retrieved successfully',
    type: [DeviceProfileResponseDto],
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  getDevicesForProfile(@Request() req, @Param('profileId') profileId: string) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.deviceProfileService.getDevicesForProfile(user, profileId);
  }
}

@ApiTags('Device Profiles')
@ApiBearerAuth('access-token')
@Controller('device-bindings')
export class DeviceBindingsController {
  constructor(private readonly deviceProfileService: DeviceProfileService) {}

  @Get()
  @ApiOperation({
    summary: 'List all device-profile bindings for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Device bindings retrieved successfully',
  })
  getAllBindings(@Request() req) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.deviceProfileService.getAllDeviceBindings(user);
  }
}
