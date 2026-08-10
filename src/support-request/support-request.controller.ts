import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Request,
  ValidationPipe,
  Param,
  Query,
} from '@nestjs/common';
import { SupportRequestService } from './support-request.service';
import {
  CreateSupportRequestDto,
  UpdateSupportRequestDto,
  SupportRequestResponseDto,
} from './dto/support-request.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Support Request Management')
@Controller('support-request')
export class SupportRequestController {
  constructor(private readonly supportRequestService: SupportRequestService) {}

  @Post('submit')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Submit a new support request' })
  @ApiResponse({
    status: 201,
    description: 'Support request submitted successfully',
    type: SupportRequestResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiBody({ type: CreateSupportRequestDto })
  submitSupportRequest(
    @Request() req,
    @Body(ValidationPipe) dto: CreateSupportRequestDto,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.supportRequestService.createSupportRequest(user, dto);
  }

  @Get('all')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get all support requests for current user' })
  @ApiResponse({
    status: 200,
    description: 'Support requests retrieved successfully',
    type: [SupportRequestResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  getSupportRequests(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.supportRequestService.getSupportRequests(user, page, limit);
  }

  @Get('one/:id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a specific support request by ID' })
  @ApiResponse({
    status: 200,
    description: 'Support request retrieved successfully',
    type: SupportRequestResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Support request not found' })
  @ApiParam({ name: 'id', description: 'Support request ID' })
  getSupportRequest(@Request() req, @Param('id') id: string) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.supportRequestService.getSupportRequest(user, id);
  }

  @Patch('update/:id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a specific support request' })
  @ApiResponse({
    status: 200,
    description: 'Support request updated successfully',
    type: SupportRequestResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Support request not found' })
  @ApiParam({ name: 'id', description: 'Support request ID' })
  @ApiBody({ type: UpdateSupportRequestDto })
  updateSupportRequest(
    @Request() req,
    @Param('id') id: string,
    @Body(ValidationPipe) dto: UpdateSupportRequestDto,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.supportRequestService.updateSupportRequest(user, id, dto);
  }

  @Patch('delete/:id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a specific support request' })
  @ApiResponse({
    status: 200,
    description: 'Support request deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Support request not found' })
  @ApiParam({ name: 'id', description: 'Support request ID' })
  deleteSupportRequest(@Request() req, @Param('id') id: string) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.supportRequestService.deleteSupportRequest(user, id);
  }

  @Get('search')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Search support requests by subject or message content',
  })
  @ApiResponse({
    status: 200,
    description: 'Support requests search completed successfully',
    type: [SupportRequestResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiQuery({ name: 'query', required: true, description: 'Search query' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  searchSupportRequests(
    @Request() req,
    @Query('query') query: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.supportRequestService.searchSupportRequests(
      user,
      query,
      page,
      limit,
    );
  }

  @Get('recent')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get recent support requests for current user' })
  @ApiResponse({
    status: 200,
    description: 'Recent support requests retrieved successfully',
    type: [SupportRequestResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of recent support requests to retrieve',
  })
  getRecentSupportRequests(@Request() req, @Query('limit') limit: number = 5) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.supportRequestService.getRecentSupportRequests(user, limit);
  }

  @Get('stats')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get support request statistics for current user' })
  @ApiResponse({
    status: 200,
    description: 'Support request statistics retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  getSupportRequestStats(@Request() req) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.supportRequestService.getSupportRequestStats(user);
  }
}
