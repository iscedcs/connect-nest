import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreateSocialDto, UpdateSocialDto, BulkVisibilityDto, BulkDeleteDto, BulkRestoreDto } from './dto/social.dto';

@Injectable()
export class SocialService {
  constructor(private readonly databaseService: DatabaseService) {}

  async addSocial(user: any, dto: CreateSocialDto) {
    try {
      // Get default profile for backward compatibility
      const profile = await this.databaseService.profile.findFirst({
        where: { userId: user.id, is_default: true, deletedAt: null },
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
          is_visible: dto.is_visible !== undefined ? dto.is_visible : true,
          order: dto.order,
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
      // Get default profile for backward compatibility
      const profile = await this.databaseService.profile.findFirst({
        where: { userId: user.id, is_default: true, deletedAt: null },
      });

      if (!profile) {
        throw new BadRequestException('Profile not found');
      }

      const socials = await this.databaseService.social.findMany({
        where: {
          userId: profile.id,
          deletedAt: null,
        },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
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
      // Get default profile for backward compatibility
      const profile = await this.databaseService.profile.findFirst({
        where: { userId: user.id, is_default: true, deletedAt: null },
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
      // Get default profile for backward compatibility
      const profile = await this.databaseService.profile.findFirst({
        where: { userId: user.id, is_default: true, deletedAt: null },
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
          is_visible: dto.is_visible,
          order: dto.order,
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
      // Get default profile for backward compatibility
      const profile = await this.databaseService.profile.findFirst({
        where: { userId: user.id, is_default: true, deletedAt: null },
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
      // Get default profile for backward compatibility
      const profile = await this.databaseService.profile.findFirst({
        where: { userId: user.id, is_default: true, deletedAt: null },
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
      // Get default profile for backward compatibility
      const profile = await this.databaseService.profile.findFirst({
        where: { userId: user.id, is_default: true, deletedAt: null },
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
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
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
      // Get default profile for backward compatibility
      const profile = await this.databaseService.profile.findFirst({
        where: { userId: user.id, is_default: true, deletedAt: null },
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

  // Profile-scoped methods
  async createProfileSocial(user: any, profileId: string, dto: CreateSocialDto) {
    try {
      // Verify profile belongs to user
      const profile = await this.databaseService.profile.findFirst({
        where: {
          id: profileId,
          userId: user.id,
          deletedAt: null,
        },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      const social = await this.databaseService.social.create({
        data: {
          userId: profile.id,
          platform: dto.platform,
          label: dto.label,
          value: dto.value,
          is_visible: dto.is_visible !== undefined ? dto.is_visible : true,
          order: dto.order,
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

  async getAllProfileSocials(
    user: any,
    profileId: string,
    page: number = 1,
    perPage: number = 25,
    includeDeleted: boolean = false,
    sort?: string,
    order: 'asc' | 'desc' = 'asc'
  ) {
    try {
      // Verify profile belongs to user
      const profile = await this.databaseService.profile.findFirst({
        where: {
          id: profileId,
          userId: user.id,
        },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      const skip = (page - 1) * perPage;
      const where: any = { userId: profile.id };
      
      if (!includeDeleted) {
        where.deletedAt = null;
      }

      const orderBy: any = {};
      if (sort) {
        orderBy[sort] = order;
      } else {
        orderBy.order = 'asc';
        orderBy.createdAt = 'asc';
      }

      const [socials, total] = await Promise.all([
        this.databaseService.social.findMany({
          where,
          skip,
          take: perPage,
          orderBy: [orderBy],
        }),
        this.databaseService.social.count({ where }),
      ]);

      return {
        success: true,
        message: 'Social media retrieved successfully',
        data: {
          socials,
          pagination: {
            page,
            per_page: perPage,
            total,
            pages: Math.ceil(total / perPage),
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

  async getProfileSocialById(user: any, profileId: string, socialId: string) {
    try {
      // Verify profile belongs to user
      const profile = await this.databaseService.profile.findFirst({
        where: {
          id: profileId,
          userId: user.id,
        },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      const social = await this.databaseService.social.findFirst({
        where: {
          id: socialId,
          userId: profile.id,
          deletedAt: null,
        },
      });

      if (!social) {
        return {
          success: false,
          message: 'Social media not found',
        };
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

  async updateProfileSocial(
    user: any,
    profileId: string,
    socialId: string,
    dto: UpdateSocialDto
  ) {
    try {
      // Verify profile belongs to user
      const profile = await this.databaseService.profile.findFirst({
        where: {
          id: profileId,
          userId: user.id,
          deletedAt: null,
        },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      const social = await this.databaseService.social.findFirst({
        where: {
          id: socialId,
          userId: profile.id,
          deletedAt: null,
        },
      });

      if (!social) {
        return {
          success: false,
          message: 'Social media not found',
        };
      }

      const updatedSocial = await this.databaseService.social.update({
        where: { id: socialId },
        data: {
          platform: dto.platform,
          label: dto.label,
          value: dto.value,
          is_visible: dto.is_visible,
          order: dto.order,
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

  async deleteProfileSocial(user: any, profileId: string, socialId: string) {
    try {
      // Verify profile belongs to user
      const profile = await this.databaseService.profile.findFirst({
        where: {
          id: profileId,
          userId: user.id,
          deletedAt: null,
        },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      const social = await this.databaseService.social.findFirst({
        where: {
          id: socialId,
          userId: profile.id,
          deletedAt: null,
        },
      });

      if (!social) {
        return {
          success: false,
          message: 'Social media not found',
        };
      }

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

  async restoreProfileSocial(user: any, profileId: string, socialId: string) {
    try {
      // Verify profile belongs to user
      const profile = await this.databaseService.profile.findFirst({
        where: {
          id: profileId,
          userId: user.id,
        },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      const social = await this.databaseService.social.findFirst({
        where: {
          id: socialId,
          userId: profile.id,
        },
      });

      if (!social) {
        return {
          success: false,
          message: 'Social media not found',
        };
      }

      const restoredSocial = await this.databaseService.social.update({
        where: { id: socialId },
        data: {
          deletedAt: null,
        },
      });

      return {
        success: true,
        message: 'Social media restored successfully',
        data: {
          social: restoredSocial,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async toggleVisibility(user: any, profileId: string, socialId: string, isVisible: boolean) {
    try {
      // Verify profile belongs to user
      const profile = await this.databaseService.profile.findFirst({
        where: {
          id: profileId,
          userId: user.id,
          deletedAt: null,
        },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      const social = await this.databaseService.social.findFirst({
        where: {
          id: socialId,
          userId: profile.id,
          deletedAt: null,
        },
      });

      if (!social) {
        return {
          success: false,
          message: 'Social media not found',
        };
      }

      const updatedSocial = await this.databaseService.social.update({
        where: { id: socialId },
        data: {
          is_visible: isVisible,
        },
      });

      return {
        success: true,
        message: 'Social media visibility updated successfully',
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

  async bulkDelete(user: any, profileId: string, dto: BulkDeleteDto) {
    try {
      // Verify profile belongs to user
      const profile = await this.databaseService.profile.findFirst({
        where: {
          id: profileId,
          userId: user.id,
          deletedAt: null,
        },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      const where: any = { userId: profile.id, deletedAt: null };
      
      if (dto.ids && dto.ids.length > 0) {
        where.id = { in: dto.ids };
      }

      await this.databaseService.social.updateMany({
        where,
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

  async bulkRestore(user: any, profileId: string, dto: BulkRestoreDto) {
    try {
      // Verify profile belongs to user
      const profile = await this.databaseService.profile.findFirst({
        where: {
          id: profileId,
          userId: user.id,
        },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      const where: any = { userId: profile.id };
      where.deletedAt = { not: null };

      if (dto.ids && dto.ids.length > 0) {
        where.id = { in: dto.ids };
      }

      await this.databaseService.social.updateMany({
        where,
        data: {
          deletedAt: null,
        },
      });

      return {
        success: true,
        message: 'Social media restored successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async bulkVisibility(user: any, profileId: string, dto: BulkVisibilityDto) {
    try {
      // Verify profile belongs to user
      const profile = await this.databaseService.profile.findFirst({
        where: {
          id: profileId,
          userId: user.id,
          deletedAt: null,
        },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      await this.databaseService.social.updateMany({
        where: {
          userId: profile.id,
          id: { in: dto.ids },
          deletedAt: null,
        },
        data: {
          is_visible: dto.is_visible,
        },
      });

      return {
        success: true,
        message: 'Social media visibility updated successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getProfileSocialsByPlatform(user: any, profileId: string, platform: string) {
    try {
      // Verify profile belongs to user
      const profile = await this.databaseService.profile.findFirst({
        where: {
          id: profileId,
          userId: user.id,
          deletedAt: null,
        },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      const socials = await this.databaseService.social.findMany({
        where: {
          userId: profile.id,
          platform: platform,
          deletedAt: null,
        },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
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
}
