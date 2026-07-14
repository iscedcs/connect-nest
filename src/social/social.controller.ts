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
  Patch,
} from '@nestjs/common';
import { SocialService } from './social.service';
import {
  CreateSocialDto,
  UpdateSocialDto,
  SocialResponseDto,
  BulkVisibilityDto,
  BulkDeleteDto,
  BulkRestoreDto,
} from './dto/social.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Social Media Management')
@ApiBearerAuth('access-token')
@Controller('social')
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Post('add')
  @ApiOperation({ summary: "Add a social media account to user's profile" })
  @ApiResponse({
    status: 201,
    description: 'Social media added successfully',
    type: SocialResponseDto,
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
    type: [SocialResponseDto],
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
    type: SocialResponseDto,
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
    type: SocialResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Social media not found' })
  @ApiParam({ name: 'id', description: 'Social media ID' })
  @ApiBody({ type: UpdateSocialDto })
  updateSocial(
    @Request() req,
    @Param('id') id: string,
    @Body(ValidationPipe) dto: UpdateSocialDto,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.socialService.updateSocial(user, id, dto);
  }

  @Patch('delete/:id')
  @ApiOperation({ summary: 'Delete a specific social media account' })
  @ApiResponse({
    status: 200,
    description: 'Social media deleted successfully',
  })
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
  @ApiOperation({
    summary: 'Delete all social media accounts for current user',
  })
  @ApiResponse({
    status: 200,
    description: 'All social media deleted successfully',
  })
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
    type: [SocialResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiParam({
    name: 'platform',
    description: 'Platform name (e.g., LinkedIn, Twitter)',
  })
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
    description: 'Social media statistics retrieved successfully',
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

@ApiTags('Profile Social Media')
@ApiBearerAuth('access-token')
@Controller('profiles/:profileId/social')
export class ProfileSocialController {
  constructor(private readonly socialService: SocialService) {}

  @Post('add')
  @ApiOperation({ summary: 'Add a social media account to a profile' })
  @ApiResponse({
    status: 201,
    description: 'Social media added successfully',
    type: SocialResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: CreateSocialDto })
  createProfileSocial(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: CreateSocialDto,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.socialService.createProfileSocial(user, profileId, dto);
  }

  @Get('all')
  @ApiOperation({ summary: 'List all social media accounts for a profile' })
  @ApiResponse({
    status: 200,
    description: 'Social media accounts retrieved successfully',
    type: [SocialResponseDto],
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
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
    description: 'Include deleted socials',
    example: false,
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    description: 'Field to sort by',
    example: 'createdAt',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    description: 'Sort order',
    enum: ['asc', 'desc'],
  })
  getAllProfileSocials(
    @Request() req,
    @Param('profileId') profileId: string,
    @Query('page') page: number = 1,
    @Query('per_page') perPage: number = 25,
    @Query('include_deleted') includeDeleted: boolean = false,
    @Query('sort') sort?: string,
    @Query('order') order: 'asc' | 'desc' = 'asc',
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.socialService.getAllProfileSocials(
      user,
      profileId,
      page,
      perPage,
      includeDeleted,
      sort,
      order,
    );
  }

  @Get('one/:id')
  @ApiOperation({ summary: 'Get a specific social media account by ID' })
  @ApiResponse({
    status: 200,
    description: 'Social media retrieved successfully',
    type: SocialResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Social media not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Social media ID' })
  getProfileSocialById(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.socialService.getProfileSocialById(user, profileId, id);
  }

  @Patch('update/:id')
  @ApiOperation({ summary: 'Update a specific social media account' })
  @ApiResponse({
    status: 200,
    description: 'Social media updated successfully',
    type: SocialResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Social media not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Social media ID' })
  @ApiBody({ type: UpdateSocialDto })
  updateProfileSocial(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
    @Body(ValidationPipe) dto: UpdateSocialDto,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.socialService.updateProfileSocial(user, profileId, id, dto);
  }

  @Patch('delete/:id')
  @ApiOperation({ summary: 'Soft delete a specific social media account' })
  @ApiResponse({
    status: 204,
    description: 'Social media deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Social media not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Social media ID' })
  deleteProfileSocial(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.socialService.deleteProfileSocial(user, profileId, id);
  }

  @Patch('restore/:id')
  @ApiOperation({ summary: 'Restore a soft-deleted social media account' })
  @ApiResponse({
    status: 200,
    description: 'Social media restored successfully',
    type: SocialResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Social media not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Social media ID' })
  restoreProfileSocial(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.socialService.restoreProfileSocial(user, profileId, id);
  }

  @Patch('visibility/:id')
  @ApiOperation({ summary: 'Toggle visibility of a social media account' })
  @ApiResponse({
    status: 200,
    description: 'Social media visibility updated successfully',
    type: SocialResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Social media not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Social media ID' })
  @ApiBody({
    schema: { type: 'object', properties: { is_visible: { type: 'boolean' } } },
  })
  toggleVisibility(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
    @Body('is_visible') isVisible: boolean,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.socialService.toggleVisibility(user, profileId, id, isVisible);
  }

  @Patch('all/delete')
  @ApiOperation({ summary: 'Bulk delete social media accounts' })
  @ApiResponse({
    status: 204,
    description: 'Social media deleted successfully',
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: BulkDeleteDto })
  bulkDelete(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: BulkDeleteDto,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.socialService.bulkDelete(user, profileId, dto);
  }

  @Patch('all/restore')
  @ApiOperation({ summary: 'Bulk restore social media accounts' })
  @ApiResponse({
    status: 200,
    description: 'Social media restored successfully',
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: BulkRestoreDto })
  bulkRestore(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: BulkRestoreDto,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.socialService.bulkRestore(user, profileId, dto);
  }

  @Patch('visibility/all')
  @ApiOperation({ summary: 'Bulk update visibility of social media accounts' })
  @ApiResponse({
    status: 204,
    description: 'Social media visibility updated successfully',
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: BulkVisibilityDto })
  bulkVisibility(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: BulkVisibilityDto,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.socialService.bulkVisibility(user, profileId, dto);
  }

  @Get('platform/:platform')
  @ApiOperation({
    summary: 'Get social media accounts by platform for a profile',
  })
  @ApiResponse({
    status: 200,
    description: 'Social media accounts retrieved successfully',
    type: [SocialResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({
    name: 'platform',
    description: 'Platform name (e.g., LinkedIn, Twitter)',
  })
  getProfileSocialsByPlatform(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('platform') platform: string,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.socialService.getProfileSocialsByPlatform(
      user,
      profileId,
      platform,
    );
  }
}
