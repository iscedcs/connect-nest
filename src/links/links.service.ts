import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import {
  CreateLinkDto,
  UpdateLinkDto,
  BulkVisibilityDto,
  BulkDeleteDto,
  BulkRestoreDto,
  ReorderLinksDto,
} from './dto/link.dto';

@Injectable()
export class LinksService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createLink(user: any, profileId: string, dto: CreateLinkDto) {
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

      const link = await this.databaseService.link.create({
        data: {
          profileId,
          title: dto.title,
          url: dto.url,
          image: dto.image,
          order: dto.order,
          is_visible: dto.is_visible !== undefined ? dto.is_visible : true,
        },
      });

      return {
        success: true,
        message: 'Link created successfully',
        data: {
          link,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getAllLinks(
    user: any,
    profileId: string,
    page: number = 1,
    perPage: number = 25,
    includeDeleted: boolean = false,
    sort?: string,
    order: 'asc' | 'desc' = 'asc',
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

      const orderBy: any[] = [];
      if (sort) {
        orderBy.push({ [sort]: order });
      } else {
        orderBy.push({ order: 'asc' });
        orderBy.push({ createdAt: 'asc' });
      }

      const [links, total] = await Promise.all([
        this.databaseService.link.findMany({
          where,
          skip,
          take: perPage,
          orderBy: orderBy,
        }),
        this.databaseService.link.count({ where }),
      ]);

      return {
        success: true,
        message: 'Links retrieved successfully',
        data: {
          links,
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

  async getLinkById(user: any, profileId: string, linkId: string) {
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

      const link = await this.databaseService.link.findFirst({
        where: {
          id: linkId,
          profileId,
          deletedAt: null,
        },
      });

      if (!link) {
        return {
          success: false,
          message: 'Link not found',
        };
      }

      return {
        success: true,
        message: 'Link retrieved successfully',
        data: {
          link,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async updateLink(
    user: any,
    profileId: string,
    linkId: string,
    dto: UpdateLinkDto,
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

      const link = await this.databaseService.link.findFirst({
        where: {
          id: linkId,
          profileId,
          deletedAt: null,
        },
      });

      if (!link) {
        return {
          success: false,
          message: 'Link not found',
        };
      }

      const updatedLink = await this.databaseService.link.update({
        where: { id: linkId },
        data: {
          title: dto.title,
          url: dto.url,
          image: dto.image,
          order: dto.order,
          is_visible: dto.is_visible,
        },
      });

      return {
        success: true,
        message: 'Link updated successfully',
        data: {
          link: updatedLink,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async deleteLink(user: any, profileId: string, linkId: string) {
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

      const link = await this.databaseService.link.findFirst({
        where: {
          id: linkId,
          profileId,
          deletedAt: null,
        },
      });

      if (!link) {
        return {
          success: false,
          message: 'Link not found',
        };
      }

      await this.databaseService.link.update({
        where: { id: linkId },
        data: {
          deletedAt: new Date(),
        },
      });

      return {
        success: true,
        message: 'Link deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async restoreLink(user: any, profileId: string, linkId: string) {
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

      const link = await this.databaseService.link.findFirst({
        where: {
          id: linkId,
          profileId,
        },
      });

      if (!link) {
        return {
          success: false,
          message: 'Link not found',
        };
      }

      const restoredLink = await this.databaseService.link.update({
        where: { id: linkId },
        data: {
          deletedAt: null,
        },
      });

      return {
        success: true,
        message: 'Link restored successfully',
        data: {
          link: restoredLink,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async toggleVisibility(
    user: any,
    profileId: string,
    linkId: string,
    isVisible: boolean,
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

      const link = await this.databaseService.link.findFirst({
        where: {
          id: linkId,
          profileId,
          deletedAt: null,
        },
      });

      if (!link) {
        return {
          success: false,
          message: 'Link not found',
        };
      }

      const updatedLink = await this.databaseService.link.update({
        where: { id: linkId },
        data: {
          is_visible: isVisible,
        },
      });

      return {
        success: true,
        message: 'Link visibility updated successfully',
        data: {
          link: updatedLink,
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

      await this.databaseService.link.updateMany({
        where,
        data: {
          deletedAt: new Date(),
        },
      });

      return {
        success: true,
        message: 'Links deleted successfully',
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

      await this.databaseService.link.updateMany({
        where,
        data: {
          deletedAt: null,
        },
      });

      return {
        success: true,
        message: 'Links restored successfully',
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

      await this.databaseService.link.updateMany({
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
        message: 'Links visibility updated successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async reorderLinks(user: any, profileId: string, dto: ReorderLinksDto) {
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

      // Update order for each link based on its position in the array
      const updatePromises = dto.order.map((linkId, index) => {
        return this.databaseService.link.updateMany({
          where: {
            id: linkId,
            profileId,
            deletedAt: null,
          },
          data: {
            order: index + 1,
          },
        });
      });

      await Promise.all(updatePromises);

      return {
        success: true,
        message: 'Links reordered successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
