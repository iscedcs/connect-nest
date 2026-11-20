import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Request,
  ValidationPipe,
  Param,
  Query,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ContactService } from './contact.service';
import { CreateContactDto, ContactResponseDto } from './dto/contact.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PublicRoute } from 'src/auth/decorators/public-route.decorator';
import { PlanFeature } from 'src/subscriptions/decorators/plan-feature.decorator';
import { PlanLimitGuard } from 'src/subscriptions/guards/plan-limit.guard';

@ApiTags('Contact Management')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @PublicRoute()
  @Post('leave')
  @ApiOperation({
    summary: 'Leave contact information for a profile owner (Guest endpoint)',
  })
  @ApiResponse({
    status: 201,
    description: 'Contact information submitted successfully',
    type: ContactResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiBody({ type: CreateContactDto })
  leaveContact(@Body(ValidationPipe) dto: CreateContactDto) {
    return this.contactService.leaveContact(dto);
  }
}

@ApiTags('Profile Contacts Management')
@ApiBearerAuth('access-token')
@Controller('profiles/:profileId/contact')
export class ProfileContactController {
  constructor(private readonly contactService: ContactService) {}

  @Get('export')
  @PlanFeature('contactExport')
  @UseGuards(PlanLimitGuard)
  @ApiOperation({ summary: 'Export received contacts' })
  @ApiResponse({ status: 200, description: 'Contacts exported successfully' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  exportContacts(@Request() req, @Param('profileId') profileId: string) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.contactService.exportContacts(user, profileId);
  }

  @Get('received')
  @ApiOperation({
    summary:
      'Get all contacts received by current user (Profile owner endpoint)',
  })
  @ApiResponse({
    status: 200,
    description: 'Received contacts retrieved successfully',
    type: [ContactResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  getReceivedContacts(
    @Request() req,
    @Param('profileId') profileId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.contactService.getReceivedContacts(
      user,
      profileId,
      page,
      limit,
    );
  }

  @Get('one/:id')
  @ApiOperation({ summary: 'Get a specific received contact by ID' })
  @ApiResponse({
    status: 200,
    description: 'Contact retrieved successfully',
    type: ContactResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  getContact(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.contactService.getContact(user, profileId, id);
  }

  @Patch('delete/:id')
  @ApiOperation({ summary: 'Delete a specific received contact' })
  @ApiResponse({ status: 200, description: 'Contact deleted successfully' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  deleteContact(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('id') id: string,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.contactService.deleteContact(user, profileId, id);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search received contacts by various fields' })
  @ApiResponse({
    status: 200,
    description: 'Contacts retrieved successfully',
    type: [ContactResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiQuery({ name: 'q', required: true, description: 'Search term' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  searchReceivedContacts(
    @Request() req,
    @Param('profileId') profileId: string,
    @Query('q') searchTerm: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.contactService.searchReceivedContacts(
      user,
      profileId,
      searchTerm,
      page,
      limit,
    );
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent contacts received by current user' })
  @ApiResponse({
    status: 200,
    description: 'Recent contacts retrieved successfully',
    type: [ContactResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of recent contacts to retrieve',
  })
  getRecentContacts(
    @Request() req,
    @Param('profileId') profileId: string,
    @Query('limit') limit: number = 5,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.contactService.getRecentContacts(user, profileId, limit);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get contact statistics for current user' })
  @ApiResponse({
    status: 200,
    description: 'Contact statistics retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  getContactStats(@Request() req, @Param('profileId') profileId: string) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.contactService.getContactStats(user, profileId);
  }
}
