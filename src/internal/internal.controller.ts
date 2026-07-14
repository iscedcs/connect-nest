import { Controller, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PublicRoute } from '../auth/decorators/public-route.decorator';
import { InternalGuard } from './internal.guard';
import { InternalService } from './internal.service';

@ApiTags('Internal')
@Controller('internal')
@PublicRoute()
@UseGuards(InternalGuard)
export class InternalController {
  constructor(private readonly internalService: InternalService) {}

  @Delete('user/:userId')
  @ApiOperation({
    summary: '[Internal] Soft-delete all connect data for a user',
    description:
      'Called by isce-auth when a user account is deleted. ' +
      'Requires X-Internal-Secret header.',
  })
  @ApiResponse({ status: 200, description: 'User data soft-deleted.' })
  @ApiResponse({
    status: 403,
    description: 'Invalid or missing internal secret.',
  })
  deleteUserData(@Param('userId') userId: string) {
    return this.internalService.deleteUserData(userId);
  }

  @Get('user/:userId/export')
  @ApiOperation({
    summary: '[Internal] Export all connect data for a user',
    description:
      'Called by isce-auth to aggregate GDPR export data. ' +
      'Requires X-Internal-Secret header.',
  })
  @ApiResponse({ status: 200, description: 'User data returned.' })
  @ApiResponse({
    status: 403,
    description: 'Invalid or missing internal secret.',
  })
  exportUserData(@Param('userId') userId: string) {
    return this.internalService.exportUserData(userId);
  }
}
