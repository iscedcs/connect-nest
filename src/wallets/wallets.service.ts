import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import {
  CreateWalletDto,
  UpdateWalletDto,
  BulkVisibilityDto,
  BulkDeleteDto,
  BulkRestoreDto,
} from './dto/wallet.dto';

@Injectable()
export class WalletsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createWallet(user: any, profileId: string, dto: CreateWalletDto) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const wallet = await this.databaseService.wallet.create({
        data: {
          profileId,
          network: dto.network,
          address: dto.address,
          label: dto.label,
          ens: dto.ens,
          is_default: false,
          is_visible: dto.is_visible !== undefined ? dto.is_visible : true,
        },
      });
      return {
        success: true,
        message: 'Wallet created successfully',
        data: { wallet },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getAllWallets(
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
      const orderBy: any = sort ? { [sort]: order } : { createdAt: order };

      const [wallets, total] = await Promise.all([
        this.databaseService.wallet.findMany({
          where,
          skip,
          take: perPage,
          orderBy: [orderBy],
        }),
        this.databaseService.wallet.count({ where }),
      ]);

      return {
        success: true,
        message: 'Wallets retrieved successfully',
        data: {
          wallets,
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

  async getWalletById(user: any, profileId: string, walletId: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const wallet = await this.databaseService.wallet.findFirst({
        where: { id: walletId, profileId, deletedAt: null },
      });
      if (!wallet) return { success: false, message: 'Wallet not found' };

      return {
        success: true,
        message: 'Wallet retrieved successfully',
        data: { wallet },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async updateWallet(
    user: any,
    profileId: string,
    walletId: string,
    dto: UpdateWalletDto,
  ) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const wallet = await this.databaseService.wallet.findFirst({
        where: { id: walletId, profileId, deletedAt: null },
      });
      if (!wallet) return { success: false, message: 'Wallet not found' };

      const updatedWallet = await this.databaseService.wallet.update({
        where: { id: walletId },
        data: {
          network: dto.network,
          address: dto.address,
          label: dto.label,
          ens: dto.ens,
          is_visible: dto.is_visible,
        },
      });
      return {
        success: true,
        message: 'Wallet updated successfully',
        data: { wallet: updatedWallet },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async deleteWallet(user: any, profileId: string, walletId: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const wallet = await this.databaseService.wallet.findFirst({
        where: { id: walletId, profileId, deletedAt: null },
      });
      if (!wallet) return { success: false, message: 'Wallet not found' };

      await this.databaseService.wallet.update({
        where: { id: walletId },
        data: { deletedAt: new Date() },
      });
      return { success: true, message: 'Wallet deleted successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async restoreWallet(user: any, profileId: string, walletId: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const wallet = await this.databaseService.wallet.findFirst({
        where: { id: walletId, profileId },
      });
      if (!wallet) return { success: false, message: 'Wallet not found' };

      const restoredWallet = await this.databaseService.wallet.update({
        where: { id: walletId },
        data: { deletedAt: null },
      });
      return {
        success: true,
        message: 'Wallet restored successfully',
        data: { wallet: restoredWallet },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async toggleVisibility(
    user: any,
    profileId: string,
    walletId: string,
    isVisible: boolean,
  ) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const wallet = await this.databaseService.wallet.findFirst({
        where: { id: walletId, profileId, deletedAt: null },
      });
      if (!wallet) return { success: false, message: 'Wallet not found' };

      const updatedWallet = await this.databaseService.wallet.update({
        where: { id: walletId },
        data: { is_visible: isVisible },
      });
      return {
        success: true,
        message: 'Wallet visibility updated successfully',
        data: { wallet: updatedWallet },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async setDefaultWallet(user: any, profileId: string, walletId: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const wallet = await this.databaseService.wallet.findFirst({
        where: { id: walletId, profileId, deletedAt: null },
      });
      if (!wallet) return { success: false, message: 'Wallet not found' };

      await this.databaseService.wallet.updateMany({
        where: {
          profileId,
          id: { not: walletId },
          is_default: true,
          deletedAt: null,
        },
        data: { is_default: false },
      });
      const updatedWallet = await this.databaseService.wallet.update({
        where: { id: walletId },
        data: { is_default: true },
      });
      return {
        success: true,
        message: 'Default wallet set successfully',
        data: { wallet: updatedWallet },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getDefaultWallet(user: any, profileId: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const wallet = await this.databaseService.wallet.findFirst({
        where: { profileId, is_default: true, deletedAt: null },
      });
      if (!wallet)
        return { success: false, message: 'Default wallet not found' };

      return {
        success: true,
        message: 'Default wallet retrieved successfully',
        data: { wallet },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getWalletsByNetwork(user: any, profileId: string, network: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const wallets = await this.databaseService.wallet.findMany({
        where: { profileId, network: network, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      return {
        success: true,
        message: 'Wallets retrieved successfully',
        data: { wallets },
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

      await this.databaseService.wallet.updateMany({
        where,
        data: { deletedAt: new Date() },
      });
      return { success: true, message: 'Wallets deleted successfully' };
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

      await this.databaseService.wallet.updateMany({
        where,
        data: { deletedAt: null },
      });
      return { success: true, message: 'Wallets restored successfully' };
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

      await this.databaseService.wallet.updateMany({
        where: { profileId, id: { in: dto.ids }, deletedAt: null },
        data: { is_visible: dto.is_visible },
      });
      return {
        success: true,
        message: 'Wallets visibility updated successfully',
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}
