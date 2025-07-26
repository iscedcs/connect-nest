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
import { NotificationService } from './notification.service';
import { 
  CreateNotificationDto, 
  NotificationResponseDto 
} from './dto/notification.dto';
import { 
  ApiBearerAuth, 
  ApiBody, 
  ApiOperation, 
  ApiResponse, 
  ApiTags, 
  ApiParam, 
  ApiQuery 
} from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';

@ApiTags('Notification Management')
@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create a new notification for a user' })
  @ApiResponse({ 
    status: 201, 
    description: 'Notification created successfully',
    type: NotificationResponseDto
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiBody({ type: CreateNotificationDto })
  createNotification(@Body(ValidationPipe) dto: CreateNotificationDto) {
    return this.notificationService.createNotification(dto);
  }

  @Get('all')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get all notifications for current user' })
  @ApiResponse({ 
    status: 200, 
    description: 'Notifications retrieved successfully',
    type: [NotificationResponseDto]
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  getNotifications(
    @Request() req, 
    @Query('page') page: number = 1, 
    @Query('limit') limit: number = 10
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.notificationService.getNotifications(user, page, limit);
  }

  @Get('one/:id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a specific notification by ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Notification retrieved successfully',
    type: NotificationResponseDto
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  getNotification(@Request() req, @Param('id') id: string) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.notificationService.getNotification(user, id);
  }

  @Patch('read/:id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Mark a specific notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  markAsRead(@Request() req, @Param('id') id: string) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.notificationService.markAsRead(user, id);
  }

  @Patch('read-all')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Mark all notifications as read for current user' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  markAllAsRead(@Request() req) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.notificationService.markAllAsRead(user);
  }

  @Patch('delete/:id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a specific notification' })
  @ApiResponse({ status: 200, description: 'Notification deleted successfully' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  deleteNotification(@Request() req, @Param('id') id: string) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.notificationService.deleteNotification(user, id);
  }

  @Get('unread')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get unread notifications for current user' })
  @ApiResponse({ 
    status: 200, 
    description: 'Unread notifications retrieved successfully',
    type: [NotificationResponseDto]
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  getUnreadNotifications(
    @Request() req, 
    @Query('page') page: number = 1, 
    @Query('limit') limit: number = 10
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.notificationService.getUnreadNotifications(user, page, limit);
  }

  @Get('type/:type')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get notifications by type for current user' })
  @ApiResponse({ 
    status: 200, 
    description: 'Notifications retrieved successfully',
    type: [NotificationResponseDto]
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiParam({ name: 'type', description: 'Notification type (CARD_INTERACTION, CONTACT_SHARED)' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  getNotificationsByType(
    @Request() req, 
    @Param('type') type: NotificationType,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.notificationService.getNotificationsByType(user, type, page, limit);
  }

  @Get('recent')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get recent notifications for current user' })
  @ApiResponse({ 
    status: 200, 
    description: 'Recent notifications retrieved successfully',
    type: [NotificationResponseDto]
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of recent notifications to retrieve' })
  getRecentNotifications(@Request() req, @Query('limit') limit: number = 5) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.notificationService.getRecentNotifications(user, limit);
  }

  @Get('stats')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get notification statistics for current user' })
  @ApiResponse({ 
    status: 200, 
    description: 'Notification statistics retrieved successfully'
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  getNotificationStats(@Request() req) {
    const user = req.isce_auth;
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return this.notificationService.getNotificationStats(user);
  }
}
