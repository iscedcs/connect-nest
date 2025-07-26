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
import { CardInteractionsService } from './card-interactions.service';
import { 
  CreateCardInteractionDto, 
  UpdateCardInteractionDto,
  CardInteractionResponseDto 
} from './dto/card-interaction.dto';
import { 
  ApiBearerAuth, 
  ApiBody, 
  ApiOperation, 
  ApiResponse, 
  ApiTags, 
  ApiParam, 
  ApiQuery 
} from '@nestjs/swagger';
import { ScanType } from '@prisma/client';

@ApiTags('Card Interactions Management')
@Controller('card-interactions')
export class CardInteractionsController {
  constructor(private readonly cardInteractionsService: CardInteractionsService) {}

  @Post('record')
  @ApiOperation({ summary: 'Record a new card interaction (System endpoint)' })
  @ApiResponse({ 
    status: 201, 
    description: 'Card interaction recorded successfully',
    type: CardInteractionResponseDto
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiBody({ type: CreateCardInteractionDto })
  recordCardInteraction(@Body(ValidationPipe) dto: CreateCardInteractionDto) {
    return this.cardInteractionsService.recordCardInteraction(dto);
  }

  @Get('all')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get all card interactions for current user' })
  @ApiResponse({ 
    status: 200, 
    description: 'Card interactions retrieved successfully',
    type: [CardInteractionResponseDto]
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  getCardInteractions(
    @Request() req, 
    @Query('page') page: number = 1, 
    @Query('limit') limit: number = 10
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.cardInteractionsService.getCardInteractions(user, page, limit);
  }

  @Get('one/:id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a specific card interaction by ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Card interaction retrieved successfully',
    type: CardInteractionResponseDto
  })
  @ApiResponse({ status: 404, description: 'Card interaction not found' })
  @ApiParam({ name: 'id', description: 'Card interaction ID' })
  getCardInteraction(@Request() req, @Param('id') id: string) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.cardInteractionsService.getCardInteraction(user, id);
  }

  @Patch('update/:id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a specific card interaction' })
  @ApiResponse({ 
    status: 200, 
    description: 'Card interaction updated successfully',
    type: CardInteractionResponseDto
  })
  @ApiResponse({ status: 404, description: 'Card interaction not found' })
  @ApiParam({ name: 'id', description: 'Card interaction ID' })
  @ApiBody({ type: UpdateCardInteractionDto })
  updateCardInteraction(
    @Request() req, 
    @Param('id') id: string, 
    @Body(ValidationPipe) dto: UpdateCardInteractionDto
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.cardInteractionsService.updateCardInteraction(user, id, dto);
  }

  @Patch('delete/:id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a specific card interaction' })
  @ApiResponse({ status: 200, description: 'Card interaction deleted successfully' })
  @ApiResponse({ status: 404, description: 'Card interaction not found' })
  @ApiParam({ name: 'id', description: 'Card interaction ID' })
  deleteCardInteraction(@Request() req, @Param('id') id: string) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.cardInteractionsService.deleteCardInteraction(user, id);
  }

  @Get('method/:method')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get card interactions by method (TAP or SCAN)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Card interactions retrieved successfully',
    type: [CardInteractionResponseDto]
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiParam({ name: 'method', description: 'Interaction method (TAP, SCAN)' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  getInteractionsByMethod(
    @Request() req, 
    @Param('method') method: ScanType,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.cardInteractionsService.getInteractionsByMethod(user, method, page, limit);
  }

  @Get('device/:deviceId')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get card interactions by device ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Card interactions retrieved successfully',
    type: [CardInteractionResponseDto]
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  getInteractionsByDevice(
    @Request() req, 
    @Param('deviceId') deviceId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.cardInteractionsService.getInteractionsByDevice(user, deviceId, page, limit);
  }

  @Get('recent')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get recent card interactions for current user' })
  @ApiResponse({ 
    status: 200, 
    description: 'Recent card interactions retrieved successfully',
    type: [CardInteractionResponseDto]
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of recent interactions to retrieve' })
  getRecentInteractions(@Request() req, @Query('limit') limit: number = 10) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.cardInteractionsService.getRecentInteractions(user, limit);
  }

  @Get('stats')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get card interaction statistics for current user' })
  @ApiResponse({ 
    status: 200, 
    description: 'Card interaction statistics retrieved successfully'
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  getInteractionStats(@Request() req) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.cardInteractionsService.getInteractionStats(user);
  }

  @Get('date-range')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get card interactions within a date range' })
  @ApiResponse({ 
    status: 200, 
    description: 'Card interactions retrieved successfully',
    type: [CardInteractionResponseDto]
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiQuery({ name: 'startDate', required: true, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: true, description: 'End date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  getInteractionsByDateRange(
    @Request() req, 
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.cardInteractionsService.getInteractionsByDateRange(user, startDate, endDate, page, limit);
  }
}
