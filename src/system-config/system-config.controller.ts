import {
  Controller,
  Get,
  Patch,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SystemConfigService } from './system-config.service';
import { UpdateSubscriptionConfigDto } from './dto/system-config.dto';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { PublicRoute } from '../auth/decorators/public-route.decorator';

@ApiTags('System Configuration')
@Controller()
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get('system-config/subscription-status')
  @PublicRoute()
  @ApiOperation({
    summary: 'Public endpoint to check subscription status and availability',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns active subscription availability flags',
  })
  async getPublicSubscriptionStatus() {
    const config = await this.systemConfigService.getConfig();
    return {
      success: true,
      data: {
        personalSubscriptionsEnabled: config.personalSubscriptionsEnabled,
        connectPlusSubscriptionsEnabled: config.connectPlusSubscriptionsEnabled,
        bypassMode: config.bypassMode,
        maintenanceReason: config.maintenanceReason,
      },
    };
  }

  @Get('admin/system-config/subscriptions')
  @ApiBearerAuth()
  @UseGuards(SuperAdminGuard)
  @ApiOperation({
    summary: 'Get complete system subscription settings (Super Admin only)',
  })
  @ApiResponse({ status: 200, description: 'Settings retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Super Admin access required' })
  async getAdminSubscriptionConfig() {
    const config = await this.systemConfigService.getConfig();
    return {
      success: true,
      data: { config },
    };
  }

  @Patch('admin/system-config/subscriptions')
  @ApiBearerAuth()
  @UseGuards(SuperAdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update subscription toggles and bypass modes (Super Admin only)',
  })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  @ApiResponse({ status: 403, description: 'Super Admin access required' })
  async updateAdminSubscriptionConfig(
    @Req() req: any,
    @Body() dto: UpdateSubscriptionConfigDto,
  ) {
    const user = req.isce_auth || req.user;
    const updated = await this.systemConfigService.updateConfig(
      dto,
      user?.id || 'admin',
    );
    return {
      success: true,
      message: 'System subscription configuration updated successfully',
      data: { config: updated },
    };
  }
}
