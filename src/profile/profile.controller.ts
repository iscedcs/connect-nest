import {
  Controller,
  Get,
  Post,
  Body,
  Request,
  ValidationPipe,
  Query,
  Param,
  Patch,
} from '@nestjs/common';
import { ProfileService } from './profile.service';
import {
  CreateProfileDto,
  UpdateProfileDto,
  ProfileResponseDto,
  ProfileStatsResponseDto,
  CloneProfileDto,
} from './dto/profile.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PublicRoute } from '../auth/decorators/public-route.decorator';

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
    type: ProfileResponseDto,
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
  @ApiOperation({ summary: "Get current user's profile with all related data" })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully',
    type: ProfileResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  getProfile(@Request() req) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.profileService.getProfile(user);
  }

  @Patch('update')
  @ApiOperation({ summary: "Update current user's profile" })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    type: ProfileResponseDto,
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
  @ApiOperation({ summary: "Delete current user's profile (soft delete)" })
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
    type: ProfileStatsResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  getProfileStats(@Request() req) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.profileService.getProfileStats(user);
  }

  // Public Profile Endpoint
  @PublicRoute()
  @Get('public/:deviceId')
  @ApiOperation({
    summary: 'Get public profile by device ID (no auth required)',
  })
  @ApiParam({ name: 'deviceId', description: 'The NFC/QR device UID' })
  @ApiResponse({
    status: 200,
    description: 'Public profile retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Device or profile not found' })
  async getPublicProfile(@Param('deviceId') deviceId: string) {
    return this.profileService.getPublicProfileByDeviceId(deviceId);
  }

  // Public Profile by Slug Endpoint
  @PublicRoute()
  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get public profile by slug (no auth required)' })
  @ApiParam({ name: 'slug', description: 'The unique profile slug' })
  @ApiResponse({
    status: 200,
    description: 'Public profile retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async getPublicProfileBySlug(@Param('slug') slug: string) {
    return this.profileService.getPublicProfileBySlug(slug);
  }
}

@ApiTags('Multi-Profile Management')
@ApiBearerAuth('access-token')
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('all')
  @ApiOperation({ summary: 'List all profiles for the current user' })
  @ApiResponse({
    status: 200,
    description: 'Profiles retrieved successfully',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number',
    example: 1,
  })
  @ApiQuery({
    name: 'per_page',
    required: false,
    description: 'Items per page',
    example: 25,
  })
  @ApiQuery({
    name: 'include_deleted',
    required: false,
    description: 'Include deleted profiles',
    example: false,
  })
  getAllProfiles(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('per_page') perPage: number = 25,
    @Query('include_deleted') includeDeleted: boolean = false,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.profileService.getAllProfiles(
      user,
      page,
      perPage,
      includeDeleted,
    );
  }

  @Get('one/:profileId')
  @ApiOperation({ summary: 'Get a specific profile by ID' })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully',
    type: ProfileResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  getProfileById(@Request() req, @Param('profileId') profileId: string) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.profileService.getProfileById(user, profileId);
  }

  @Patch('update/:profileId')
  @ApiOperation({ summary: 'Update a specific profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    type: ProfileResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: UpdateProfileDto })
  updateProfileById(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: UpdateProfileDto,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.profileService.updateProfileById(user, profileId, dto);
  }

  @Patch('delete/:profileId')
  @ApiOperation({ summary: 'Soft delete a specific profile' })
  @ApiResponse({ status: 204, description: 'Profile deleted successfully' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  deleteProfileById(@Request() req, @Param('profileId') profileId: string) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.profileService.deleteProfileById(user, profileId);
  }

  @Patch('restore/:profileId')
  @ApiOperation({ summary: 'Restore a soft-deleted profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile restored successfully',
    type: ProfileResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  restoreProfile(@Request() req, @Param('profileId') profileId: string) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.profileService.restoreProfile(user, profileId);
  }

  @Patch('set-default/:profileId')
  @ApiOperation({ summary: 'Set a profile as the default profile' })
  @ApiResponse({
    status: 200,
    description: 'Default profile set successfully',
    type: ProfileResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  setDefaultProfile(@Request() req, @Param('profileId') profileId: string) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.profileService.setDefaultProfile(user, profileId);
  }

  @Get('default')
  @ApiOperation({ summary: 'Get the current default profile' })
  @ApiResponse({
    status: 200,
    description: 'Default profile retrieved successfully',
    type: ProfileResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Default profile not found' })
  getDefaultProfile(@Request() req) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.profileService.getDefaultProfile(user);
  }

  @Post('clone/:profileId')
  @ApiOperation({ summary: 'Clone a profile and optionally its resources' })
  @ApiResponse({
    status: 201,
    description: 'Profile cloned successfully',
    type: ProfileResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Source profile not found' })
  @ApiParam({ name: 'profileId', description: 'Source Profile ID to clone' })
  @ApiBody({ type: CloneProfileDto })
  cloneProfile(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: CloneProfileDto,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.profileService.cloneProfile(user, profileId, dto);
  }
}
