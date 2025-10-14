import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreateSocialDto, UpdateSocialDto } from './dto/social.dto';

@Injectable()
export class SocialService {
  constructor(private readonly databaseService: DatabaseService) {}

  async addSocial(user: any, dto: CreateSocialDto) {
    try {
      const profile = await this.databaseService.profile.findUnique({
        where: { userId: user.id, deletedAt: null },
      });

      if (!profile) {
        throw new BadRequestException('Profile not found');
      }

      const social = await this.databaseService.social.create({
        data: {
          userId: profile.id,
          platform: dto.platform,
          label: dto.label,
          value: dto.value,
        },
      });

      return {
        success: true,
        message: 'Social media added successfully',
        data: {
          social,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getSocials(user: any) {
    try {
      const profile = await this.databaseService.profile.findUnique({
        where: { userId: user.id, deletedAt: null },
      });

      if (!profile) {
        throw new BadRequestException('Profile not found');
      }

      const socials = await this.databaseService.social.findMany({
        where: {
          userId: profile.id,
          deletedAt: null,
        },
        orderBy: { createdAt: 'asc' },
      });

      return {
        success: true,
        message: 'Social media retrieved successfully',
        data: {
          socials,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getSocial(user: any, socialId: string) {
    try {
      const profile = await this.databaseService.profile.findUnique({
        where: { userId: user.id, deletedAt: null },
      });

      if (!profile) {
        throw new BadRequestException('Profile not found');
      }

      const social = await this.databaseService.social.findFirst({
        where: {
          id: socialId,
          userId: profile.id,
          deletedAt: null,
        },
      });

      if (!social) {
        throw new BadRequestException('Socials not found');
      }

      return {
        success: true,
        message: 'Social media retrieved successfully',
        data: {
          social,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async updateSocial(user: any, socialId: string, dto: UpdateSocialDto) {
    try {
      const profile = await this.databaseService.profile.findUnique({
        where: { userId: user.id, deletedAt: null },
      });

      if (!profile) {
        throw new BadRequestException('Profile not found');
      }

      const social = await this.databaseService.social.findFirst({
        where: {
          id: socialId,
          userId: profile.id,
          deletedAt: null,
        },
      });

      if (!social) {
        throw new BadRequestException('Social media not found');
      }

      const updatedSocial = await this.databaseService.social.update({
        where: { id: socialId },
        data: {
          platform: dto.platform,
          label: dto.label,
          value: dto.value,
        },
      });

      return {
        success: true,
        message: 'Social media updated successfully',
        data: {
          social: updatedSocial,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async deleteSocial(user: any, socialId: string) {
    try {
      const profile = await this.databaseService.profile.findUnique({
        where: { userId: user.id, deletedAt: null },
      });

      if (!profile) {
        throw new BadRequestException('Profile not found');
      }

      const social = await this.databaseService.social.findFirst({
        where: {
          id: socialId,
          userId: profile.id,
          deletedAt: null,
        },
      });

      if (!social) {
        throw new BadRequestException('Social media not found');
      }

      // Soft delete the social media
      await this.databaseService.social.update({
        where: { id: socialId },
        data: {
          deletedAt: new Date(),
        },
      });

      return {
        success: true,
        message: 'Social media deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async deleteAllSocials(user: any) {
    try {
      const profile = await this.databaseService.profile.findUnique({
        where: { userId: user.id, deletedAt: null },
      });

      if (!profile) {
        throw new BadRequestException('Profile not found');
      }

      // Soft delete all social media for this profile
      await this.databaseService.social.updateMany({
        where: {
          userId: profile.id,
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
        },
      });

      return {
        success: true,
        message: 'All social media deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getSocialsByPlatform(user: any, platform: string) {
    try {
      const profile = await this.databaseService.profile.findUnique({
        where: { userId: user.id },
      });

      if (!profile) {
        throw new BadRequestException('Profile not found');
      }

      const socials = await this.databaseService.social.findMany({
        where: {
          userId: profile.id,
          platform: platform,
          deletedAt: null,
        },
        orderBy: { createdAt: 'asc' },
      });

      return {
        success: true,
        message: 'Social media retrieved successfully',
        data: {
          socials,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getSocialsStats(user: any) {
    try {
      const profile = await this.databaseService.profile.findUnique({
        where: { userId: user.id, deletedAt: null },
      });

      if (!profile) {
        throw new BadRequestException('Profile not found');
      }

      const totalSocials = await this.databaseService.social.count({
        where: {
          userId: profile.id,
          deletedAt: null,
        },
      });

      const platforms = await this.databaseService.social.groupBy({
        by: ['platform'],
        where: {
          userId: profile.id,
          deletedAt: null,
        },
        _count: {
          platform: true,
        },
      });

      return {
        success: true,
        message: 'Social media statistics retrieved successfully',
        data: {
          stats: {
            totalSocials,
            platforms: platforms.map(p => ({
              platform: p.platform,
              count: p._count.platform,
            })),
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
