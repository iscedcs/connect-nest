import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreateSupportRequestDto, UpdateSupportRequestDto } from './dto/support-request.dto';

@Injectable()
export class SupportRequestService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createSupportRequest(user: any, dto: CreateSupportRequestDto) {
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

      const supportRequest = await this.databaseService.supportRequest.create({
        data: {
          userId: profile.id,
          subject: dto.subject,
          message: dto.message,
        },
      });

      return {
        success: true,
        message: 'Support request submitted successfully',
        data: {
          supportRequest,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getSupportRequests(user: any, page: number = 1, limit: number = 10) {
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

      const supportRequests = await this.databaseService.supportRequest.findMany({
        where: {
          userId: profile.id,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      });

      const total = await this.databaseService.supportRequest.count({
        where: {
          userId: profile.id,
          deletedAt: null,
        },
      });

      return {
        success: true,
        message: 'Support requests retrieved successfully',
        data: {
          supportRequests,
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

  async getSupportRequest(user: any, supportRequestId: string) {
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

      const supportRequest = await this.databaseService.supportRequest.findFirst({
        where: {
          id: supportRequestId,
          userId: profile.id,
          deletedAt: null,
        },
      });

      if (!supportRequest) {
        return {
          success: false,
          message: 'Support request not found',
        };
      }

      return {
        success: true,
        message: 'Support request retrieved successfully',
        data: {
          supportRequest,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async updateSupportRequest(user: any, supportRequestId: string, dto: UpdateSupportRequestDto) {
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

      const existingRequest = await this.databaseService.supportRequest.findFirst({
        where: {
          id: supportRequestId,
          userId: profile.id,
          deletedAt: null,
        },
      });

      if (!existingRequest) {
        return {
          success: false,
          message: 'Support request not found',
        };
      }

      const updatedRequest = await this.databaseService.supportRequest.update({
        where: { id: supportRequestId },
        data: {
          subject: dto.subject,
          message: dto.message,
        },
      });

      return {
        success: true,
        message: 'Support request updated successfully',
        data: {
          supportRequest: updatedRequest,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async deleteSupportRequest(user: any, supportRequestId: string) {
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

      const supportRequest = await this.databaseService.supportRequest.findFirst({
        where: {
          id: supportRequestId,
          userId: profile.id,
          deletedAt: null,
        },
      });

      if (!supportRequest) {
        return {
          success: false,
          message: 'Support request not found',
        };
      }

      // Soft delete the support request
      await this.databaseService.supportRequest.update({
        where: { id: supportRequestId },
        data: {
          deletedAt: new Date(),
        },
      });

      return {
        success: true,
        message: 'Support request deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async searchSupportRequests(user: any, query: string, page: number = 1, limit: number = 10) {
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

      const supportRequests = await this.databaseService.supportRequest.findMany({
        where: {
          userId: profile.id,
          deletedAt: null,
          OR: [
            {
              subject: {
                contains: query,
                mode: 'insensitive',
              },
            },
            {
              message: {
                contains: query,
                mode: 'insensitive',
              },
            },
          ],
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      });

      const total = await this.databaseService.supportRequest.count({
        where: {
          userId: profile.id,
          deletedAt: null,
          OR: [
            {
              subject: {
                contains: query,
                mode: 'insensitive',
              },
            },
            {
              message: {
                contains: query,
                mode: 'insensitive',
              },
            },
          ],
        },
      });

      return {
        success: true,
        message: 'Support requests search completed successfully',
        data: {
          supportRequests,
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

  async getRecentSupportRequests(user: any, limit: number = 5) {
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

      const supportRequests = await this.databaseService.supportRequest.findMany({
        where: {
          userId: profile.id,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return {
        success: true,
        message: 'Recent support requests retrieved successfully',
        data: {
          supportRequests,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getSupportRequestStats(user: any) {
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

      const totalRequests = await this.databaseService.supportRequest.count({
        where: {
          userId: profile.id,
          deletedAt: null,
        },
      });

      const todayRequests = await this.databaseService.supportRequest.count({
        where: {
          userId: profile.id,
          deletedAt: null,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      });

      const thisWeekRequests = await this.databaseService.supportRequest.count({
        where: {
          userId: profile.id,
          deletedAt: null,
          createdAt: {
            gte: new Date(new Date().setDate(new Date().getDate() - 7)),
          },
        },
      });

      const thisMonthRequests = await this.databaseService.supportRequest.count({
        where: {
          userId: profile.id,
          deletedAt: null,
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      });

      return {
        success: true,
        message: 'Support request statistics retrieved successfully',
        data: {
          stats: {
            totalRequests,
            todayRequests,
            thisWeekRequests,
            thisMonthRequests,
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
