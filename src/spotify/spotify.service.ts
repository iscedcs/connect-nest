import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import {
  CreateSpotifyDto,
  UpdateSpotifyDto,
  BulkVisibilityDto,
  BulkDeleteDto,
  BulkRestoreDto,
} from './dto/spotify.dto';

@Injectable()
export class SpotifyService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createSpotifyItem(user: any, profileId: string, dto: CreateSpotifyDto) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const item = await this.databaseService.spotifyItem.create({
        data: {
          profileId,
          type: dto.type,
          external_url: dto.external_url,
          title: dto.title,
          is_visible: dto.is_visible !== undefined ? dto.is_visible : true,
          order: dto.order,
        },
      });
      return {
        success: true,
        message: 'Spotify item created successfully',
        data: { item },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getAllSpotifyItems(
    user: any,
    profileId: string,
    page: number = 1,
    perPage: number = 25,
    includeDeleted: boolean = false,
    sort?: string,
    order: 'asc' | 'desc' = 'asc',
  ) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const skip = (page - 1) * perPage;
      const where: any = { profileId };
      if (!includeDeleted) where.deletedAt = null;
      const orderBy: any[] = [];
      if (sort) {
        orderBy.push({ [sort]: order });
      } else {
        orderBy.push({ order: 'asc' });
        orderBy.push({ createdAt: 'asc' });
      }

      const [items, total] = await Promise.all([
        this.databaseService.spotifyItem.findMany({
          where,
          skip,
          take: perPage,
          orderBy: orderBy,
        }),
        this.databaseService.spotifyItem.count({ where }),
      ]);

      return {
        success: true,
        message: 'Spotify items retrieved successfully',
        data: {
          items,
          pagination: {
            page,
            per_page: perPage,
            total,
            pages: Math.ceil(total / perPage),
          },
        },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getSpotifyItemById(user: any, profileId: string, itemId: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const item = await this.databaseService.spotifyItem.findFirst({
        where: { id: itemId, profileId, deletedAt: null },
      });
      if (!item) return { success: false, message: 'Spotify item not found' };

      return {
        success: true,
        message: 'Spotify item retrieved successfully',
        data: { item },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async updateSpotifyItem(
    user: any,
    profileId: string,
    itemId: string,
    dto: UpdateSpotifyDto,
  ) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const item = await this.databaseService.spotifyItem.findFirst({
        where: { id: itemId, profileId, deletedAt: null },
      });
      if (!item) return { success: false, message: 'Spotify item not found' };

      const updatedItem = await this.databaseService.spotifyItem.update({
        where: { id: itemId },
        data: {
          type: dto.type,
          external_url: dto.external_url,
          title: dto.title,
          is_visible: dto.is_visible,
          order: dto.order,
        },
      });
      return {
        success: true,
        message: 'Spotify item updated successfully',
        data: { item: updatedItem },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async deleteSpotifyItem(user: any, profileId: string, itemId: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const item = await this.databaseService.spotifyItem.findFirst({
        where: { id: itemId, profileId, deletedAt: null },
      });
      if (!item) return { success: false, message: 'Spotify item not found' };

      await this.databaseService.spotifyItem.update({
        where: { id: itemId },
        data: { deletedAt: new Date() },
      });
      return { success: true, message: 'Spotify item deleted successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async restoreSpotifyItem(user: any, profileId: string, itemId: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const item = await this.databaseService.spotifyItem.findFirst({
        where: { id: itemId, profileId },
      });
      if (!item) return { success: false, message: 'Spotify item not found' };

      const restoredItem = await this.databaseService.spotifyItem.update({
        where: { id: itemId },
        data: { deletedAt: null },
      });
      return {
        success: true,
        message: 'Spotify item restored successfully',
        data: { item: restoredItem },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async toggleVisibility(
    user: any,
    profileId: string,
    itemId: string,
    isVisible: boolean,
  ) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const item = await this.databaseService.spotifyItem.findFirst({
        where: { id: itemId, profileId, deletedAt: null },
      });
      if (!item) return { success: false, message: 'Spotify item not found' };

      const updatedItem = await this.databaseService.spotifyItem.update({
        where: { id: itemId },
        data: { is_visible: isVisible },
      });
      return {
        success: true,
        message: 'Spotify item visibility updated successfully',
        data: { item: updatedItem },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getSpotifyItemsByType(user: any, profileId: string, type: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const items = await this.databaseService.spotifyItem.findMany({
        where: { profileId, type: type, deletedAt: null },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      });
      return {
        success: true,
        message: 'Spotify items retrieved successfully',
        data: { items },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async bulkDelete(user: any, profileId: string, dto: BulkDeleteDto) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const where: any = { profileId, deletedAt: null };
      if (dto.ids && dto.ids.length > 0) where.id = { in: dto.ids };

      await this.databaseService.spotifyItem.updateMany({
        where,
        data: { deletedAt: new Date() },
      });
      return { success: true, message: 'Spotify items deleted successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async bulkRestore(user: any, profileId: string, dto: BulkRestoreDto) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const where: any = { profileId, deletedAt: { not: null } };
      if (dto.ids && dto.ids.length > 0) where.id = { in: dto.ids };

      await this.databaseService.spotifyItem.updateMany({
        where,
        data: { deletedAt: null },
      });
      return { success: true, message: 'Spotify items restored successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async bulkVisibility(user: any, profileId: string, dto: BulkVisibilityDto) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      await this.databaseService.spotifyItem.updateMany({
        where: { profileId, id: { in: dto.ids }, deletedAt: null },
        data: { is_visible: dto.is_visible },
      });
      return {
        success: true,
        message: 'Spotify items visibility updated successfully',
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}
