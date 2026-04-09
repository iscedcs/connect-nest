import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Request,
  Param,
  ForbiddenException,
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
  AdminReassignDeviceDto,
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

@ApiTags('Admin Device Profiles')
@ApiBearerAuth('access-token')
@Controller('admin/device-profiles')
export class AdminDeviceProfileController {
  constructor(private readonly deviceProfileService: DeviceProfileService) {}

  private ensureSuperAdmin(req: any) {
    const user = req.isce_auth;
    if (!user || user.userType !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Access denied - Super Admin only');
    }
    return user;
  }

  @Patch('reassign')
  @ApiOperation({
    summary: 'Reassign a device to a different profile (Super Admin only)',
  })
  @ApiBody({ type: AdminReassignDeviceDto })
  @ApiResponse({
    status: 200,
    description: 'Device reassigned successfully',
  })
  @ApiResponse({ status: 403, description: 'Access denied - Super Admin only' })
  @ApiResponse({ status: 404, description: 'Profile or device not found' })
  async reassignDevice(
    @Request() req,
    @Body(ValidationPipe) dto: AdminReassignDeviceDto,
  ) {
    this.ensureSuperAdmin(req);
    return this.deviceProfileService.adminReassignDevice(
      dto.deviceId,
      dto.newProfileId,
    );
  }

  @Delete('unlink/:deviceId')
  @ApiOperation({
    summary: 'Unlink a device from its current profile (Super Admin only)',
  })
  @ApiParam({ name: 'deviceId', description: 'Device product ID to unlink' })
  @ApiResponse({ status: 200, description: 'Device unlinked successfully' })
  @ApiResponse({ status: 403, description: 'Access denied - Super Admin only' })
  @ApiResponse({ status: 404, description: 'Device not linked' })
  async unlinkDevice(@Request() req, @Param('deviceId') deviceId: string) {
    this.ensureSuperAdmin(req);
    return this.deviceProfileService.adminUnlinkDevice(deviceId);
  }
}
