import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreateNotificationDto } from './dto/notification.dto';
import { NotificationType } from '../generated/prisma/client';

@Injectable()
export class NotificationService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createNotification(dto: CreateNotificationDto) {
    try {
      // Verify the profile exists
      const profile = await this.databaseService.profile.findUnique({
        where: { id: dto.profileId },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      const notification = await this.databaseService.notification.create({
        data: {
          userId: dto.profileId,
          title: dto.title,
          message: dto.message,
          type: dto.type,
        },
      });

      return {
        success: true,
        message: 'Notification created successfully',
        data: {
          notification,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getNotifications(user: any, page: number = 1, limit: number = 10) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { userId: user.id },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      const skip = (page - 1) * limit;

      const notifications = await this.databaseService.notification.findMany({
        where: {
          userId: profile.id,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      });

      const total = await this.databaseService.notification.count({
        where: {
          userId: profile.id,
          deletedAt: null,
        },
      });

      return {
        success: true,
        message: 'Notifications retrieved successfully',
        data: {
          notifications,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getNotification(user: any, notificationId: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { userId: user.id },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      const notification = await this.databaseService.notification.findFirst({
        where: {
          id: notificationId,
          userId: profile.id,
          deletedAt: null,
        },
      });

      if (!notification) {
        return {
          success: false,
          message: 'Notification not found',
        };
      }

      return {
        success: true,
        message: 'Notification retrieved successfully',
        data: {
          notification,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async markAsRead(user: any, notificationId: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { userId: user.id },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      const notification = await this.databaseService.notification.findFirst({
        where: {
          id: notificationId,
          userId: profile.id,
          deletedAt: null,
        },
      });

      if (!notification) {
        return {
          success: false,
          message: 'Notification not found',
        };
      }

      await this.databaseService.notification.update({
        where: { id: notificationId },
        data: {
          isRead: true,
        },
      });

      return {
        success: true,
        message: 'Notification marked as read',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async markAllAsRead(user: any) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { userId: user.id },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      await this.databaseService.notification.updateMany({
        where: {
          userId: profile.id,
          isRead: false,
          deletedAt: null,
        },
        data: {
          isRead: true,
        },
      });

      return {
        success: true,
        message: 'All notifications marked as read',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async deleteNotification(user: any, notificationId: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { userId: user.id },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      const notification = await this.databaseService.notification.findFirst({
        where: {
          id: notificationId,
          userId: profile.id,
          deletedAt: null,
        },
      });

      if (!notification) {
        return {
          success: false,
          message: 'Notification not found',
        };
      }

      // Soft delete the notification
      await this.databaseService.notification.update({
        where: { id: notificationId },
        data: {
          deletedAt: new Date(),
        },
      });

      return {
        success: true,
        message: 'Notification deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getUnreadNotifications(
    user: any,
    page: number = 1,
    limit: number = 10,
  ) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { userId: user.id },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      const skip = (page - 1) * limit;

      const notifications = await this.databaseService.notification.findMany({
        where: {
          userId: profile.id,
          isRead: false,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      });

      const total = await this.databaseService.notification.count({
        where: {
          userId: profile.id,
          isRead: false,
          deletedAt: null,
        },
      });

      return {
        success: true,
        message: 'Unread notifications retrieved successfully',
        data: {
          notifications,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getNotificationsByType(
    user: any,
    type: NotificationType,
    page: number = 1,
    limit: number = 10,
  ) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { userId: user.id },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      const skip = (page - 1) * limit;

      const notifications = await this.databaseService.notification.findMany({
        where: {
          userId: profile.id,
          type: type,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      });

      const total = await this.databaseService.notification.count({
        where: {
          userId: profile.id,
          type: type,
          deletedAt: null,
        },
      });

      return {
        success: true,
        message: 'Notifications retrieved successfully',
        data: {
          notifications,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getRecentNotifications(user: any, limit: number = 5) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { userId: user.id },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      const notifications = await this.databaseService.notification.findMany({
        where: {
          userId: profile.id,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return {
        success: true,
        message: 'Recent notifications retrieved successfully',
        data: {
          notifications,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getNotificationStats(user: any) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { userId: user.id },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      const totalNotifications = await this.databaseService.notification.count({
        where: {
          userId: profile.id,
          deletedAt: null,
        },
      });

      const unreadNotifications = await this.databaseService.notification.count(
        {
          where: {
            userId: profile.id,
            isRead: false,
            deletedAt: null,
          },
        },
      );

      const cardInteractionNotifications =
        await this.databaseService.notification.count({
          where: {
            userId: profile.id,
            type: 'CARD_INTERACTION',
            deletedAt: null,
          },
        });

      const contactSharedNotifications =
        await this.databaseService.notification.count({
          where: {
            userId: profile.id,
            type: 'CONTACT_SHARED',
            deletedAt: null,
          },
        });

      const todayNotifications = await this.databaseService.notification.count({
        where: {
          userId: profile.id,
          deletedAt: null,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      });

      const thisWeekNotifications =
        await this.databaseService.notification.count({
          where: {
            userId: profile.id,
            deletedAt: null,
            createdAt: {
              gte: new Date(new Date().setDate(new Date().getDate() - 7)),
            },
          },
        });

      return {
        success: true,
        message: 'Notification statistics retrieved successfully',
        data: {
          stats: {
            totalNotifications,
            unreadNotifications,
            cardInteractionNotifications,
            contactSharedNotifications,
            todayNotifications,
            thisWeekNotifications,
            readRate:
              totalNotifications > 0
                ? Math.round(
                    ((totalNotifications - unreadNotifications) /
                      totalNotifications) *
                      100,
                  )
                : 0,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
