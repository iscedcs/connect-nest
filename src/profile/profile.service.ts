import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreateProfileDto, UpdateProfileDto } from './dto/profile.dto';

@Injectable()
export class ProfileService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createProfile(user: any, dto: CreateProfileDto) {
    try {
      // Check if profile already exists for this user
      const existingProfile = await this.databaseService.profile.findUnique({
        where: { userId: user.id },
      });

      if (existingProfile) {
        return {
          success: false,
          message: 'Profile already exists for this user',
        };
      }

      const profile = await this.databaseService.profile.create({
        data: {
          userId: dto.userId,
          name: dto.name,
          position: dto.position,
          description: dto.description,
          location: dto.location,
          address: dto.address,
          profilePhoto: dto.profilePhoto,
          coverPhoto: dto.coverPhoto,
        },
      });

      return {
        success: true,
        message: 'Profile created successfully',
        data: {
          profile,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getProfile(user: any) {
    try {
      const profile = await this.databaseService.profile.findUnique({
        where: { userId: user.id, deletedAt: null },
        include: {
          socials: {
            where: { deletedAt: null },
          },
          contacts: {
            where: { deletedAt: null },
          },
          notifications: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          supportRequests: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
          },
          cardInteractions: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found, might be deleted',
        };
      }

      return {
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          profile,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async updateProfile(user: any, dto: UpdateProfileDto) {
    try {
      const profile = await this.databaseService.profile.findUnique({
        where: { userId: user.id, deletedAt: null },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      const updatedProfile = await this.databaseService.profile.update({
        where: { id: profile.id },
        data: {
          name: dto.name,
          position: dto.position,
          description: dto.description,
          location: dto.location,
          address: dto.address,
          profilePhoto: dto.profilePhoto,
          coverPhoto: dto.coverPhoto,
        },
      });

      return {
        success: true,
        message: 'Profile updated successfully',
        data: {
          profile: updatedProfile,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async deleteProfile(user: any) {
    try {
      const profile = await this.databaseService.profile.findUnique({
        where: { userId: user.id, deletedAt: null },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      // Soft delete the profile
      await this.databaseService.profile.update({
        where: { id: profile.id },
        data: {
          deletedAt: new Date(),
        },
      });

      return {
        success: true,
        message: 'Profile deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }


  async getProfileStats(user: any) {
    try {
      const profile = await this.databaseService.profile.findUnique({
        where: { userId: user.id, deletedAt: null },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      const [
        socialsCount,
        contactsCount,
        unreadNotificationsCount,
        supportRequestsCount,
        cardInteractionsCount,
      ] = await Promise.all([
        this.databaseService.social.count({
          where: {
            userId: profile.id,
            deletedAt: null,
          },
        }),
        this.databaseService.contact.count({
          where: {
            ownerId: profile.id,
            deletedAt: null,
          },
        }),
        this.databaseService.notification.count({
          where: {
            userId: profile.id,
            isRead: false,
            deletedAt: null,
          },
        }),
        this.databaseService.supportRequest.count({
          where: {
            userId: profile.id,
            deletedAt: null,
          },
        }),
        this.databaseService.cardInteraction.count({
          where: {
            userId: profile.id,
            deletedAt: null,
          },
        }),
      ]);

      return {
        success: true,
        message: 'Profile statistics retrieved successfully',
        data: {
          stats: {
            socialsCount,
            contactsCount,
            unreadNotificationsCount,
            supportRequestsCount,
            cardInteractionsCount,
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
