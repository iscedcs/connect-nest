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
import { MeetingsService } from './meetings.service';
import {
  CreateMeetingDto,
  UpdateMeetingDto,
  BulkVisibilityDto,
  BulkDeleteDto,
  BulkRestoreDto,
  MeetingResponseDto,
} from './dto/meeting.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Meetings')
@ApiBearerAuth('access-token')
@Controller('profiles/:profileId/meetings')
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Post('add')
  @ApiOperation({ summary: 'Add a meeting link to a profile' })
  @ApiResponse({
    status: 201,
    description: 'Meeting created successfully',
    type: MeetingResponseDto,
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: CreateMeetingDto })
  createMeeting(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: CreateMeetingDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.meetingsService.createMeeting(user, profileId, dto);
  }

  @Get('all')
  @ApiOperation({ summary: 'List all meetings for a profile' })
  @ApiResponse({
    status: 200,
    description: 'Meetings retrieved successfully',
    type: [MeetingResponseDto],
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'per_page', required: false })
  @ApiQuery({ name: 'include_deleted', required: false })
  @ApiQuery({ name: 'sort', required: false })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  getAllMeetings(
    @Request() req,
    @Param('profileId') profileId: string,
    @Query('page') page: number = 1,
    @Query('per_page') perPage: number = 25,
    @Query('include_deleted') includeDeleted: boolean = false,
    @Query('sort') sort?: string,
    @Query('order') order: 'asc' | 'desc' = 'asc',
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.meetingsService.getAllMeetings(
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
  @ApiOperation({ summary: 'Get a specific meeting by ID' })
  @ApiResponse({
    status: 200,
    description: 'Meeting retrieved successfully',
    type: MeetingResponseDto,
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Meeting ID' })
  getMeetingById(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.meetingsService.getMeetingById(user, profileId, id);
  }

  @Patch('update/:id')
  @ApiOperation({ summary: 'Update a specific meeting' })
  @ApiResponse({
    status: 200,
    description: 'Meeting updated successfully',
    type: MeetingResponseDto,
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Meeting ID' })
  @ApiBody({ type: UpdateMeetingDto })
  updateMeeting(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
    @Body(ValidationPipe) dto: UpdateMeetingDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.meetingsService.updateMeeting(user, profileId, id, dto);
  }

  @Patch('delete/:id')
  @ApiOperation({ summary: 'Soft delete a specific meeting' })
  @ApiResponse({ status: 204, description: 'Meeting deleted successfully' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Meeting ID' })
  deleteMeeting(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.meetingsService.deleteMeeting(user, profileId, id);
  }

  @Patch('restore/:id')
  @ApiOperation({ summary: 'Restore a soft-deleted meeting' })
  @ApiResponse({
    status: 200,
    description: 'Meeting restored successfully',
    type: MeetingResponseDto,
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Meeting ID' })
  restoreMeeting(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.meetingsService.restoreMeeting(user, profileId, id);
  }

  @Patch('visibility/:id')
  @ApiOperation({ summary: 'Toggle visibility of a meeting' })
  @ApiResponse({
    status: 200,
    description: 'Meeting visibility updated successfully',
    type: MeetingResponseDto,
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Meeting ID' })
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
    if (!user) return { success: false, message: 'User not found' };
    return this.meetingsService.toggleVisibility(
      user,
      profileId,
      id,
      isVisible,
    );
  }

  @Patch('default/:id')
  @ApiOperation({ summary: 'Set a meeting as default' })
  @ApiResponse({
    status: 200,
    description: 'Default meeting set successfully',
    type: MeetingResponseDto,
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Meeting ID' })
  setDefaultMeeting(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.meetingsService.setDefaultMeeting(user, profileId, id);
  }

  @Get('default')
  @ApiOperation({ summary: 'Get the default meeting for a profile' })
  @ApiResponse({
    status: 200,
    description: 'Default meeting retrieved successfully',
    type: MeetingResponseDto,
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  getDefaultMeeting(@Request() req, @Param('profileId') profileId: string) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.meetingsService.getDefaultMeeting(user, profileId);
  }

  @Get('provider/:provider')
  @ApiOperation({ summary: 'Get meetings by provider for a profile' })
  @ApiResponse({
    status: 200,
    description: 'Meetings retrieved successfully',
    type: [MeetingResponseDto],
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({
    name: 'provider',
    description: 'Provider name (e.g., meet, zoom)',
  })
  getMeetingsByProvider(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('provider') provider: string,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.meetingsService.getMeetingsByProvider(
      user,
      profileId,
      provider,
    );
  }

  @Patch('all/delete')
  @ApiOperation({ summary: 'Bulk delete meetings' })
  @ApiResponse({ status: 204, description: 'Meetings deleted successfully' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: BulkDeleteDto })
  bulkDelete(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: BulkDeleteDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.meetingsService.bulkDelete(user, profileId, dto);
  }

  @Patch('all/restore')
  @ApiOperation({ summary: 'Bulk restore meetings' })
  @ApiResponse({ status: 200, description: 'Meetings restored successfully' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: BulkRestoreDto })
  bulkRestore(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: BulkRestoreDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.meetingsService.bulkRestore(user, profileId, dto);
  }

  @Patch('visibility/all')
  @ApiOperation({ summary: 'Bulk update visibility of meetings' })
  @ApiResponse({
    status: 204,
    description: 'Meetings visibility updated successfully',
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: BulkVisibilityDto })
  bulkVisibility(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: BulkVisibilityDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.meetingsService.bulkVisibility(user, profileId, dto);
  }
}
