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
  Patch
} from '@nestjs/common';
import { ContactService } from './contact.service';
import { 
  CreateContactDto, 
  ContactResponseDto 
} from './dto/contact.dto';
import { 
  ApiBearerAuth, 
  ApiBody, 
  ApiOperation, 
  ApiResponse, 
  ApiTags, 
  ApiParam, 
  ApiQuery 
} from '@nestjs/swagger';
import { PublicRoute } from 'src/auth/decorators/public-route.decorator';

@ApiTags('Contact Management')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @PublicRoute()
  @Post('leave')
  @ApiOperation({ summary: 'Leave contact information for a profile owner (Guest endpoint)' })
  @ApiResponse({ 
    status: 201, 
    description: 'Contact information submitted successfully',
    type: ContactResponseDto
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiBody({ type: CreateContactDto })
  leaveContact(@Body(ValidationPipe) dto: CreateContactDto) {
    return this.contactService.leaveContact(dto);
  }

  @Get('received')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get all contacts received by current user (Profile owner endpoint)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Received contacts retrieved successfully',
    type: [ContactResponseDto]
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  getReceivedContacts(
    @Request() req, 
    @Query('page') page: number = 1, 
    @Query('limit') limit: number = 10
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.contactService.getReceivedContacts(user, page, limit);
  }

  @Get('one/:id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a specific received contact by ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Contact retrieved successfully',
    type: ContactResponseDto
  })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  getContact(@Request() req, @Param('id') id: string) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.contactService.getContact(user, id);
  }

  @Patch('delete/:id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a specific received contact' })
  @ApiResponse({ status: 200, description: 'Contact deleted successfully' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  deleteContact(@Request() req, @Param('id') id: string) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.contactService.deleteContact(user, id);
  }

  @Get('search')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Search received contacts by various fields' })
  @ApiResponse({ 
    status: 200, 
    description: 'Contacts retrieved successfully',
    type: [ContactResponseDto]
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiQuery({ name: 'q', required: true, description: 'Search term' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  searchReceivedContacts(
    @Request() req, 
    @Query('q') searchTerm: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.contactService.searchReceivedContacts(user, searchTerm, page, limit);
  }

  @Get('recent')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get recent contacts received by current user' })
  @ApiResponse({ 
    status: 200, 
    description: 'Recent contacts retrieved successfully',
    type: [ContactResponseDto]
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of recent contacts to retrieve' })
  getRecentContacts(@Request() req, @Query('limit') limit: number = 5) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.contactService.getRecentContacts(user, limit);
  }

  @Get('stats')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get contact statistics for current user' })
  @ApiResponse({ 
    status: 200, 
    description: 'Contact statistics retrieved successfully'
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  getContactStats(@Request() req) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.contactService.getContactStats(user);
  }
}
