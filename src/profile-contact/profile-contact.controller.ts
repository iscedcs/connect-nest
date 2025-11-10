import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Body, 
  Request, 
  ValidationPipe, 
  Param, 
  Query
} from '@nestjs/common';
import { ProfileContactService } from './profile-contact.service';
import { 
  CreateProfileContactDto, 
  UpdateProfileContactDto,
  BulkVisibilityDto,
  BulkDeleteDto,
  BulkRestoreDto,
  ProfileContactResponseDto
} from './dto/profile-contact.dto';
import { 
  ApiBearerAuth, 
  ApiBody, 
  ApiOperation, 
  ApiResponse, 
  ApiTags, 
  ApiParam, 
  ApiQuery 
} from '@nestjs/swagger';

@ApiTags('Profile Contacts')
@ApiBearerAuth('access-token')
@Controller('profiles/:profileId/contacts')
export class ProfileContactController {
  constructor(private readonly profileContactService: ProfileContactService) {}

  @Post('add')
  @ApiOperation({ summary: 'Add a contact phone number to a profile' })
  @ApiResponse({ 
    status: 201, 
    description: 'Profile contact created successfully',
    type: ProfileContactResponseDto
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: CreateProfileContactDto })
  createProfileContact(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: CreateProfileContactDto
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.profileContactService.createProfileContact(user, profileId, dto);
  }

  @Get('all')
  @ApiOperation({ summary: 'List all profile contacts' })
  @ApiResponse({ 
    status: 200, 
    description: 'Profile contacts retrieved successfully',
    type: [ProfileContactResponseDto]
  })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: 1 })
  @ApiQuery({ name: 'per_page', required: false, description: 'Items per page', example: 25 })
  @ApiQuery({ name: 'include_deleted', required: false, description: 'Include deleted contacts', example: false })
  @ApiQuery({ name: 'sort', required: false, description: 'Field to sort by', example: 'createdAt' })
  @ApiQuery({ name: 'order', required: false, description: 'Sort order', enum: ['asc', 'desc'] })
  getAllProfileContacts(
    @Request() req,
    @Param('profileId') profileId: string,
    @Query('page') page: number = 1,
    @Query('per_page') perPage: number = 25,
    @Query('include_deleted') includeDeleted: boolean = false,
    @Query('sort') sort?: string,
    @Query('order') order: 'asc' | 'desc' = 'asc'
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.profileContactService.getAllProfileContacts(user, profileId, page, perPage, includeDeleted, sort, order);
  }

  @Get('one/:id')
  @ApiOperation({ summary: 'Get a specific profile contact by ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Profile contact retrieved successfully',
    type: ProfileContactResponseDto
  })
  @ApiResponse({ status: 404, description: 'Profile contact not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  getProfileContactById(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.profileContactService.getProfileContactById(user, profileId, id);
  }

  @Patch('update/:id')
  @ApiOperation({ summary: 'Update a specific profile contact' })
  @ApiResponse({ 
    status: 200, 
    description: 'Profile contact updated successfully',
    type: ProfileContactResponseDto
  })
  @ApiResponse({ status: 404, description: 'Profile contact not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  @ApiBody({ type: UpdateProfileContactDto })
  updateProfileContact(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
    @Body(ValidationPipe) dto: UpdateProfileContactDto
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.profileContactService.updateProfileContact(user, profileId, id, dto);
  }

  @Patch('delete/:id')
  @ApiOperation({ summary: 'Soft delete a specific profile contact' })
  @ApiResponse({ status: 204, description: 'Profile contact deleted successfully' })
  @ApiResponse({ status: 404, description: 'Profile contact not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  deleteProfileContact(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.profileContactService.deleteProfileContact(user, profileId, id);
  }

  @Patch('restore/:id')
  @ApiOperation({ summary: 'Restore a soft-deleted profile contact' })
  @ApiResponse({ 
    status: 200, 
    description: 'Profile contact restored successfully',
    type: ProfileContactResponseDto
  })
  @ApiResponse({ status: 404, description: 'Profile contact not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  restoreProfileContact(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.profileContactService.restoreProfileContact(user, profileId, id);
  }

  @Patch('visibility/:id')
  @ApiOperation({ summary: 'Toggle visibility of a profile contact' })
  @ApiResponse({ 
    status: 200, 
    description: 'Profile contact visibility updated successfully',
    type: ProfileContactResponseDto
  })
  @ApiResponse({ status: 404, description: 'Profile contact not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  @ApiBody({ schema: { type: 'object', properties: { is_visible: { type: 'boolean' } } } })
  toggleVisibility(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
    @Body('is_visible') isVisible: boolean
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.profileContactService.toggleVisibility(user, profileId, id, isVisible);
  }

  @Patch('all/delete')
  @ApiOperation({ summary: 'Bulk delete profile contacts' })
  @ApiResponse({ status: 204, description: 'Profile contacts deleted successfully' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: BulkDeleteDto })
  bulkDelete(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: BulkDeleteDto
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.profileContactService.bulkDelete(user, profileId, dto);
  }

  @Patch('all/restore')
  @ApiOperation({ summary: 'Bulk restore profile contacts' })
  @ApiResponse({ status: 200, description: 'Profile contacts restored successfully' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: BulkRestoreDto })
  bulkRestore(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: BulkRestoreDto
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.profileContactService.bulkRestore(user, profileId, dto);
  }

  @Patch('visibility/all')
  @ApiOperation({ summary: 'Bulk update visibility of profile contacts' })
  @ApiResponse({ status: 204, description: 'Profile contacts visibility updated successfully' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: BulkVisibilityDto })
  bulkVisibility(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: BulkVisibilityDto
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.profileContactService.bulkVisibility(user, profileId, dto);
  }

  @Patch('set-primary/:id')
  @ApiOperation({ summary: 'Set a profile contact as primary' })
  @ApiResponse({ 
    status: 200, 
    description: 'Primary contact set successfully',
    type: ProfileContactResponseDto
  })
  @ApiResponse({ status: 404, description: 'Profile contact not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  setPrimaryContact(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.profileContactService.setPrimaryContact(user, profileId, id);
  }
}

