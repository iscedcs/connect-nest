import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Request,
  ValidationPipe,
  Param,
  Query,
} from '@nestjs/common';
import { VideosService } from './videos.service';
import {
  CreateVideoDto,
  UpdateVideoDto,
  BulkVisibilityDto,
  BulkDeleteDto,
  BulkRestoreDto,
  VideoResponseDto,
} from './dto/video.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Videos')
@ApiBearerAuth('access-token')
@Controller('profiles/:profileId/videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Post('add')
  @ApiOperation({ summary: 'Add a video to a profile' })
  @ApiResponse({
    status: 201,
    description: 'Video created successfully',
    type: VideoResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: CreateVideoDto })
  createVideo(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: CreateVideoDto,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.videosService.createVideo(user, profileId, dto);
  }

  @Get('all')
  @ApiOperation({ summary: 'List all videos for a profile' })
  @ApiResponse({
    status: 200,
    description: 'Videos retrieved successfully',
    type: [VideoResponseDto],
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
    description: 'Include deleted videos',
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
  getAllVideos(
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
    return this.videosService.getAllVideos(
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
  @ApiOperation({ summary: 'Get a specific video by ID' })
  @ApiResponse({
    status: 200,
    description: 'Video retrieved successfully',
    type: VideoResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Video not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Video ID' })
  getVideoById(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.videosService.getVideoById(user, profileId, id);
  }

  @Patch('update/:id')
  @ApiOperation({ summary: 'Update a specific video' })
  @ApiResponse({
    status: 200,
    description: 'Video updated successfully',
    type: VideoResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Video not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Video ID' })
  @ApiBody({ type: UpdateVideoDto })
  updateVideo(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
    @Body(ValidationPipe) dto: UpdateVideoDto,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.videosService.updateVideo(user, profileId, id, dto);
  }

  @Patch('delete/:id')
  @ApiOperation({ summary: 'Soft delete a specific video' })
  @ApiResponse({ status: 204, description: 'Video deleted successfully' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Video ID' })
  deleteVideo(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.videosService.deleteVideo(user, profileId, id);
  }

  @Patch('restore/:id')
  @ApiOperation({ summary: 'Restore a soft-deleted video' })
  @ApiResponse({
    status: 200,
    description: 'Video restored successfully',
    type: VideoResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Video not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Video ID' })
  restoreVideo(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.videosService.restoreVideo(user, profileId, id);
  }

  @Patch('visibility/:id')
  @ApiOperation({ summary: 'Toggle visibility of a video' })
  @ApiResponse({
    status: 200,
    description: 'Video visibility updated successfully',
    type: VideoResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Video not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Video ID' })
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
    return this.videosService.toggleVisibility(user, profileId, id, isVisible);
  }

  @Patch('feature/:id')
  @ApiOperation({ summary: 'Mark a video as featured (onboarding video)' })
  @ApiResponse({
    status: 200,
    description: 'Video featured successfully',
    type: VideoResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Video not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Video ID' })
  featureVideo(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.videosService.featureVideo(user, profileId, id);
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get the featured video for a profile' })
  @ApiResponse({
    status: 200,
    description: 'Featured video retrieved successfully',
    type: VideoResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Featured video not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  getFeaturedVideo(@Request() req, @Param('profileId') profileId: string) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.videosService.getFeaturedVideo(user, profileId);
  }

  @Get('platform/:platform')
  @ApiOperation({ summary: 'Get videos by platform for a profile' })
  @ApiResponse({
    status: 200,
    description: 'Videos retrieved successfully',
    type: [VideoResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({
    name: 'platform',
    description: 'Platform name (e.g., youtube, vimeo)',
  })
  getVideosByPlatform(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('platform') platform: string,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.videosService.getVideosByPlatform(user, profileId, platform);
  }

  @Patch('all/delete')
  @ApiOperation({ summary: 'Bulk delete videos' })
  @ApiResponse({ status: 204, description: 'Videos deleted successfully' })
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
    return this.videosService.bulkDelete(user, profileId, dto);
  }

  @Patch('all/restore')
  @ApiOperation({ summary: 'Bulk restore videos' })
  @ApiResponse({ status: 200, description: 'Videos restored successfully' })
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
    return this.videosService.bulkRestore(user, profileId, dto);
  }

  @Patch('visibility/all')
  @ApiOperation({ summary: 'Bulk update visibility of videos' })
  @ApiResponse({
    status: 204,
    description: 'Videos visibility updated successfully',
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
    return this.videosService.bulkVisibility(user, profileId, dto);
  }
}
