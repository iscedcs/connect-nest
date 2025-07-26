import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreateCardInteractionDto, UpdateCardInteractionDto } from './dto/card-interaction.dto';
import { ScanType } from '@prisma/client';

@Injectable()
export class CardInteractionsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async recordCardInteraction(dto: CreateCardInteractionDto) {
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

      const cardInteraction = await this.databaseService.cardInteraction.create({
        data: {
          userId: dto.profileId,
          deviceId: dto.deviceId,
          method: dto.method,
        },
      });

      return {
        success: true,
        message: 'Card interaction recorded successfully',
        data: {
          cardInteraction,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getCardInteractions(user: any, page: number = 1, limit: number = 10) {
    try {
      const profile = await this.databaseService.profile.findUnique({
        where: { userId: user.id },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      const skip = (page - 1) * limit;

      const cardInteractions = await this.databaseService.cardInteraction.findMany({
        where: {
          userId: profile.id,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      });

      const total = await this.databaseService.cardInteraction.count({
        where: {
          userId: profile.id,
          deletedAt: null,
        },
      });

      return {
        success: true,
        message: 'Card interactions retrieved successfully',
        data: {
          cardInteractions,
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

  async getCardInteraction(user: any, interactionId: string) {
    try {
      const profile = await this.databaseService.profile.findUnique({
        where: { userId: user.id },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      const cardInteraction = await this.databaseService.cardInteraction.findFirst({
        where: {
          id: interactionId,
          userId: profile.id,
          deletedAt: null,
        },
      });

      if (!cardInteraction) {
        return {
          success: false,
          message: 'Card interaction not found',
        };
      }

      return {
        success: true,
        message: 'Card interaction retrieved successfully',
        data: {
          cardInteraction,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async updateCardInteraction(user: any, interactionId: string, dto: UpdateCardInteractionDto) {
    try {
      const profile = await this.databaseService.profile.findUnique({
        where: { userId: user.id },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      const existingInteraction = await this.databaseService.cardInteraction.findFirst({
        where: {
          id: interactionId,
          userId: profile.id,
          deletedAt: null,
        },
      });

      if (!existingInteraction) {
        return {
          success: false,
          message: 'Card interaction not found',
        };
      }

      const updatedInteraction = await this.databaseService.cardInteraction.update({
        where: { id: interactionId },
        data: {
          deviceId: dto.deviceId,
          method: dto.method,
        },
      });

      return {
        success: true,
        message: 'Card interaction updated successfully',
        data: {
          cardInteraction: updatedInteraction,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async deleteCardInteraction(user: any, interactionId: string) {
    try {
      const profile = await this.databaseService.profile.findUnique({
        where: { userId: user.id },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      const cardInteraction = await this.databaseService.cardInteraction.findFirst({
        where: {
          id: interactionId,
          userId: profile.id,
          deletedAt: null,
        },
      });

      if (!cardInteraction) {
        return {
          success: false,
          message: 'Card interaction not found',
        };
      }

      // Soft delete the card interaction
      await this.databaseService.cardInteraction.update({
        where: { id: interactionId },
        data: {
          deletedAt: new Date(),
        },
      });

      return {
        success: true,
        message: 'Card interaction deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getInteractionsByMethod(user: any, method: ScanType, page: number = 1, limit: number = 10) {
    try {
      const profile = await this.databaseService.profile.findUnique({
        where: { userId: user.id },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      const skip = (page - 1) * limit;

      const cardInteractions = await this.databaseService.cardInteraction.findMany({
        where: {
          userId: profile.id,
          method: method,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      });

      const total = await this.databaseService.cardInteraction.count({
        where: {
          userId: profile.id,
          method: method,
          deletedAt: null,
        },
      });

      return {
        success: true,
        message: 'Card interactions retrieved successfully',
        data: {
          cardInteractions,
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

  async getInteractionsByDevice(user: any, deviceId: string, page: number = 1, limit: number = 10) {
    try {
      const profile = await this.databaseService.profile.findUnique({
        where: { userId: user.id },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      const skip = (page - 1) * limit;

      const cardInteractions = await this.databaseService.cardInteraction.findMany({
        where: {
          userId: profile.id,
          deviceId: deviceId,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      });

      const total = await this.databaseService.cardInteraction.count({
        where: {
          userId: profile.id,
          deviceId: deviceId,
          deletedAt: null,
        },
      });

      return {
        success: true,
        message: 'Card interactions retrieved successfully',
        data: {
          cardInteractions,
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

  async getRecentInteractions(user: any, limit: number = 10) {
    try {
      const profile = await this.databaseService.profile.findUnique({
        where: { userId: user.id },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      const cardInteractions = await this.databaseService.cardInteraction.findMany({
        where: {
          userId: profile.id,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return {
        success: true,
        message: 'Recent card interactions retrieved successfully',
        data: {
          cardInteractions,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getInteractionStats(user: any) {
    try {
      const profile = await this.databaseService.profile.findUnique({
        where: { userId: user.id },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      const totalInteractions = await this.databaseService.cardInteraction.count({
        where: {
          userId: profile.id,
          deletedAt: null,
        },
      });

      const tapInteractions = await this.databaseService.cardInteraction.count({
        where: {
          userId: profile.id,
          method: 'TAP',
          deletedAt: null,
        },
      });

      const scanInteractions = await this.databaseService.cardInteraction.count({
        where: {
          userId: profile.id,
          method: 'SCAN',
          deletedAt: null,
        },
      });

      const todayInteractions = await this.databaseService.cardInteraction.count({
        where: {
          userId: profile.id,
          deletedAt: null,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      });

      const thisWeekInteractions = await this.databaseService.cardInteraction.count({
        where: {
          userId: profile.id,
          deletedAt: null,
          createdAt: {
            gte: new Date(new Date().setDate(new Date().getDate() - 7)),
          },
        },
      });

      const thisMonthInteractions = await this.databaseService.cardInteraction.count({
        where: {
          userId: profile.id,
          deletedAt: null,
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      });

      // Get unique devices count
      const uniqueDevices = await this.databaseService.cardInteraction.groupBy({
        by: ['deviceId'],
        where: {
          userId: profile.id,
          deletedAt: null,
        },
        _count: {
          deviceId: true,
        },
      });

      return {
        success: true,
        message: 'Card interaction statistics retrieved successfully',
        data: {
          stats: {
            totalInteractions,
            tapInteractions,
            scanInteractions,
            todayInteractions,
            thisWeekInteractions,
            thisMonthInteractions,
            uniqueDevices: uniqueDevices.length,
            tapPercentage: totalInteractions > 0 ? Math.round((tapInteractions / totalInteractions) * 100) : 0,
            scanPercentage: totalInteractions > 0 ? Math.round((scanInteractions / totalInteractions) * 100) : 0,
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

  async getInteractionsByDateRange(user: any, startDate: string, endDate: string, page: number = 1, limit: number = 10) {
    try {
      const profile = await this.databaseService.profile.findUnique({
        where: { userId: user.id },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      const skip = (page - 1) * limit;

      const cardInteractions = await this.databaseService.cardInteraction.findMany({
        where: {
          userId: profile.id,
          deletedAt: null,
          createdAt: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      });

      const total = await this.databaseService.cardInteraction.count({
        where: {
          userId: profile.id,
          deletedAt: null,
          createdAt: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
      });

      return {
        success: true,
        message: 'Card interactions retrieved successfully',
        data: {
          cardInteractions,
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
}
