import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Request, 
  ValidationPipe, 
  Query, 
  Param, 
  Patch
} from '@nestjs/common';
import { ProfileService } from './profile.service';
import { 
  CreateProfileDto, 
  UpdateProfileDto, 
  PaginationDto,
  ProfileResponseDto,
  SocialResponseDto,
  ContactResponseDto,
  NotificationResponseDto,
  SupportRequestResponseDto,
  ProfileStatsResponseDto
} from './dto/profile.dto';
import { 
  ApiBearerAuth, 
  ApiBody, 
  ApiOperation, 
  ApiResponse, 
  ApiTags, 
  ApiParam, 
  ApiQuery 
} from '@nestjs/swagger';

@ApiTags('Profile Management')
@ApiBearerAuth('access-token')
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create a new user profile' })
  @ApiResponse({ 
    status: 201, 
    description: 'Profile created successfully',
    type: ProfileResponseDto
  })
  @ApiResponse({ status: 400, description: 'Failed to create profile' })
  @ApiBody({ type: CreateProfileDto })
  createProfile(@Request() req, @Body(ValidationPipe) dto: CreateProfileDto) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.profileService.createProfile(user, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user\'s profile with all related data' })
  @ApiResponse({ 
    status: 200, 
    description: 'Profile retrieved successfully',
    type: ProfileResponseDto
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  getProfile(@Request() req) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.profileService.getProfile(user);
  }

  @Put('update')
  @ApiOperation({ summary: 'Update current user\'s profile' })
  @ApiResponse({ 
    status: 200, 
    description: 'Profile updated successfully',
    type: ProfileResponseDto
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiBody({ type: UpdateProfileDto })
  updateProfile(@Request() req, @Body(ValidationPipe) dto: UpdateProfileDto) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.profileService.updateProfile(user, dto);
  }

  @Patch('delete')
  @ApiOperation({ summary: 'Delete current user\'s profile (soft delete)' })
  @ApiResponse({ status: 200, description: 'Profile deleted successfully' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  deleteProfile(@Request() req) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.profileService.deleteProfile(user);
  }


  // Statistics Endpoint
  @Get('stats')
  @ApiOperation({ summary: 'Get profile statistics for current user' })
  @ApiResponse({ 
    status: 200, 
    description: 'Profile statistics retrieved successfully',
    type: ProfileStatsResponseDto
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  getProfileStats(@Request() req) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.profileService.getProfileStats(user);
  }
}
