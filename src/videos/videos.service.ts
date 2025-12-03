import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { 
  CreateVideoDto, 
  UpdateVideoDto,
  BulkVisibilityDto,
  BulkDeleteDto,
  BulkRestoreDto
} from './dto/video.dto';

@Injectable()
export class VideosService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createVideo(user: any, profileId: string, dto: CreateVideoDto) {
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

      const video = await this.databaseService.video.create({
        data: {
          profileId,
          title: dto.title,
          platform: dto.platform,
          url: dto.url,
          thumbnail: dto.thumbnail,
          is_featured: false,
          is_visible: dto.is_visible !== undefined ? dto.is_visible : true,
        },
      });

      return {
        success: true,
        message: 'Video created successfully',
        data: {
          video,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getAllVideos(
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
      const where: any = { profileId };
      
      if (!includeDeleted) {
        where.deletedAt = null;
      }

      const orderBy: any = {};
      if (sort) {
        orderBy[sort] = order;
      } else {
        orderBy.createdAt = order;
      }

      const [videos, total] = await Promise.all([
        this.databaseService.video.findMany({
          where,
          skip,
          take: perPage,
          orderBy: [orderBy],
        }),
        this.databaseService.video.count({ where }),
      ]);

      return {
        success: true,
        message: 'Videos retrieved successfully',
        data: {
          videos,
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

  async getVideoById(user: any, profileId: string, videoId: string) {
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

      const video = await this.databaseService.video.findFirst({
        where: {
          id: videoId,
          profileId,
          deletedAt: null,
        },
      });

      if (!video) {
        return {
          success: false,
          message: 'Video not found',
        };
      }

      return {
        success: true,
        message: 'Video retrieved successfully',
        data: {
          video,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async updateVideo(
    user: any,
    profileId: string,
    videoId: string,
    dto: UpdateVideoDto
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

      const video = await this.databaseService.video.findFirst({
        where: {
          id: videoId,
          profileId,
          deletedAt: null,
        },
      });

      if (!video) {
        return {
          success: false,
          message: 'Video not found',
        };
      }

      const updateData: any = {};
      if (dto.title !== undefined) updateData.title = dto.title;
      if (dto.platform !== undefined) updateData.platform = dto.platform;
      if (dto.url !== undefined) updateData.url = dto.url;
      if (dto.thumbnail !== undefined) updateData.thumbnail = dto.thumbnail;
      if (dto.is_visible !== undefined) updateData.is_visible = dto.is_visible;

      const updatedVideo = await this.databaseService.video.update({
        where: { id: videoId },
        data: updateData,
      });

      return {
        success: true,
        message: 'Video updated successfully',
        data: {
          video: updatedVideo,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async deleteVideo(user: any, profileId: string, videoId: string) {
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

      const video = await this.databaseService.video.findFirst({
        where: {
          id: videoId,
          profileId,
          deletedAt: null,
        },
      });

      if (!video) {
        return {
          success: false,
          message: 'Video not found',
        };
      }

      await this.databaseService.video.update({
        where: { id: videoId },
        data: {
          deletedAt: new Date(),
        },
      });

      return {
        success: true,
        message: 'Video deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async restoreVideo(user: any, profileId: string, videoId: string) {
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

      const video = await this.databaseService.video.findFirst({
        where: {
          id: videoId,
          profileId,
        },
      });

      if (!video) {
        return {
          success: false,
          message: 'Video not found',
        };
      }

      const restoredVideo = await this.databaseService.video.update({
        where: { id: videoId },
        data: {
          deletedAt: null,
        },
      });

      return {
        success: true,
        message: 'Video restored successfully',
        data: {
          video: restoredVideo,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async toggleVisibility(user: any, profileId: string, videoId: string, isVisible: boolean) {
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

      const video = await this.databaseService.video.findFirst({
        where: {
          id: videoId,
          profileId,
          deletedAt: null,
        },
      });

      if (!video) {
        return {
          success: false,
          message: 'Video not found',
        };
      }

      const updatedVideo = await this.databaseService.video.update({
        where: { id: videoId },
        data: {
          is_visible: isVisible,
        },
      });

      return {
        success: true,
        message: 'Video visibility updated successfully',
        data: {
          video: updatedVideo,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async featureVideo(user: any, profileId: string, videoId: string) {
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

      const video = await this.databaseService.video.findFirst({
        where: {
          id: videoId,
          profileId,
          deletedAt: null,
        },
      });

      if (!video) {
        return {
          success: false,
          message: 'Video not found',
        };
      }

      // Unset all other featured videos for this profile
      await this.databaseService.video.updateMany({
        where: {
          profileId,
          id: { not: videoId },
          is_featured: true,
          deletedAt: null,
        },
        data: {
          is_featured: false,
        },
      });

      // Set this video as featured
      const updatedVideo = await this.databaseService.video.update({
        where: { id: videoId },
        data: {
          is_featured: true,
        },
      });

      return {
        success: true,
        message: 'Video featured successfully',
        data: {
          video: updatedVideo,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getFeaturedVideo(user: any, profileId: string) {
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

      const video = await this.databaseService.video.findFirst({
        where: {
          profileId,
          is_featured: true,
          deletedAt: null,
        },
      });

      if (!video) {
        return {
          success: false,
          message: 'Featured video not found',
        };
      }

      return {
        success: true,
        message: 'Featured video retrieved successfully',
        data: {
          video,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getVideosByPlatform(user: any, profileId: string, platform: string) {
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

      const videos = await this.databaseService.video.findMany({
        where: {
          profileId,
          platform: platform,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        success: true,
        message: 'Videos retrieved successfully',
        data: {
          videos,
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

      const where: any = { profileId, deletedAt: null };
      
      if (dto.ids && dto.ids.length > 0) {
        where.id = { in: dto.ids };
      }

      await this.databaseService.video.updateMany({
        where,
        data: {
          deletedAt: new Date(),
        },
      });

      return {
        success: true,
        message: 'Videos deleted successfully',
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

      const where: any = { profileId };
      where.deletedAt = { not: null };

      if (dto.ids && dto.ids.length > 0) {
        where.id = { in: dto.ids };
      }

      await this.databaseService.video.updateMany({
        where,
        data: {
          deletedAt: null,
        },
      });

      return {
        success: true,
        message: 'Videos restored successfully',
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

      await this.databaseService.video.updateMany({
        where: {
          profileId,
          id: { in: dto.ids },
          deletedAt: null,
        },
        data: {
          is_visible: dto.is_visible,
        },
      });

      return {
        success: true,
        message: 'Videos visibility updated successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}

