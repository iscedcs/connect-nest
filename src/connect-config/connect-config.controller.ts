import { Controller, Get, Patch, Body, Request, ValidationPipe, Param } from '@nestjs/common';
import { ConnectConfigService } from './connect-config.service';
import { UpdateConnectConfigDto, ReorderModulesDto, ConnectConfigResponseDto } from './dto/connect-config.dto';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags, ApiParam } from '@nestjs/swagger';

@ApiTags('Connect Config')
@ApiBearerAuth('access-token')
@Controller('profiles/:profileId/connect')
export class ConnectConfigController {
  constructor(private readonly connectConfigService: ConnectConfigService) {}

  @Get('config')
  @ApiOperation({ summary: 'Get connect page configuration for a profile' })
  @ApiResponse({ status: 200, description: 'Config retrieved successfully', type: ConnectConfigResponseDto })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  getConfig(@Request() req, @Param('profileId') profileId: string) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.connectConfigService.getConfig(user, profileId);
  }

  @Patch('config/update')
  @ApiOperation({ summary: 'Update connect page configuration' })
  @ApiResponse({ status: 200, description: 'Config updated successfully', type: ConnectConfigResponseDto })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: UpdateConnectConfigDto })
  updateConfig(@Request() req, @Param('profileId') profileId: string, @Body(ValidationPipe) dto: UpdateConnectConfigDto) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.connectConfigService.updateConfig(user, profileId, dto);
  }

  @Patch('config/reorder-modules')
  @ApiOperation({ summary: 'Reorder modules in connect page configuration' })
  @ApiResponse({ status: 200, description: 'Modules reordered successfully', type: ConnectConfigResponseDto })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: ReorderModulesDto })
  reorderModules(@Request() req, @Param('profileId') profileId: string, @Body(ValidationPipe) dto: ReorderModulesDto) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.connectConfigService.reorderModules(user, profileId, dto);
  }
}

