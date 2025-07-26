import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Request, 
  ValidationPipe, 
  Param, 
  Query, 
  Patch
} from '@nestjs/common';
import { SocialService } from './social.service';
import { 
  CreateSocialDto, 
  UpdateSocialDto, 
  SocialResponseDto 
} from './dto/social.dto';
import { 
  ApiBearerAuth, 
  ApiBody, 
  ApiOperation, 
  ApiResponse, 
  ApiTags, 
  ApiParam, 
  ApiQuery 
} from '@nestjs/swagger';

@ApiTags('Social Media Management')
@ApiBearerAuth('access-token')
@Controller('social')
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Post('add')
  @ApiOperation({ summary: 'Add a social media account to user\'s profile' })
  @ApiResponse({ 
    status: 201, 
    description: 'Social media added successfully',
    type: SocialResponseDto
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiBody({ type: CreateSocialDto })
  addSocial(@Request() req, @Body(ValidationPipe) dto: CreateSocialDto) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.socialService.addSocial(user, dto);
  }

  @Get('all')
  @ApiOperation({ summary: 'Get all social media accounts for current user' })
  @ApiResponse({ 
    status: 200, 
    description: 'Social media accounts retrieved successfully',
    type: [SocialResponseDto]
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  getSocials(@Request() req) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.socialService.getSocials(user);
  }

  @Get('one/:id')
  @ApiOperation({ summary: 'Get a specific social media account by ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Social media retrieved successfully',
    type: SocialResponseDto
  })
  @ApiResponse({ status: 404, description: 'Social media not found' })
  @ApiParam({ name: 'id', description: 'Social media ID' })
  getSocial(@Request() req, @Param('id') id: string) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.socialService.getSocial(user, id);
  }

  @Patch('update/:id')
  @ApiOperation({ summary: 'Update a specific social media account' })
  @ApiResponse({ 
    status: 200, 
    description: 'Social media updated successfully',
    type: SocialResponseDto
  })
  @ApiResponse({ status: 404, description: 'Social media not found' })
  @ApiParam({ name: 'id', description: 'Social media ID' })
  @ApiBody({ type: UpdateSocialDto })
  updateSocial(
    @Request() req, 
    @Param('id') id: string, 
    @Body(ValidationPipe) dto: UpdateSocialDto
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.socialService.updateSocial(user, id, dto);
  }

  @Patch('delete/:id')
  @ApiOperation({ summary: 'Delete a specific social media account' })
  @ApiResponse({ status: 200, description: 'Social media deleted successfully' })
  @ApiResponse({ status: 404, description: 'Social media not found' })
  @ApiParam({ name: 'id', description: 'Social media ID' })
  deleteSocial(@Request() req, @Param('id') id: string) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.socialService.deleteSocial(user, id);
  }

  @Patch('all/delete')
  @ApiOperation({ summary: 'Delete all social media accounts for current user' })
  @ApiResponse({ status: 200, description: 'All social media deleted successfully' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  deleteAllSocials(@Request() req) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.socialService.deleteAllSocials(user);
  }

  @Get('platform/:platform')
  @ApiOperation({ summary: 'Get social media accounts by platform' })
  @ApiResponse({ 
    status: 200, 
    description: 'Social media accounts retrieved successfully',
    type: [SocialResponseDto]
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiParam({ name: 'platform', description: 'Platform name (e.g., LinkedIn, Twitter)' })
  getSocialsByPlatform(@Request() req, @Param('platform') platform: string) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.socialService.getSocialsByPlatform(user, platform);
  }

  @Get('stats/overview')
  @ApiOperation({ summary: 'Get social media statistics for current user' })
  @ApiResponse({ 
    status: 200, 
    description: 'Social media statistics retrieved successfully'
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  getSocialsStats(@Request() req) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.socialService.getSocialsStats(user);
  }
}
