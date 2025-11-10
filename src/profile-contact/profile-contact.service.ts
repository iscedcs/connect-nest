import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { 
  CreateProfileContactDto, 
  UpdateProfileContactDto,
  BulkVisibilityDto,
  BulkDeleteDto,
  BulkRestoreDto
} from './dto/profile-contact.dto';

@Injectable()
export class ProfileContactService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createProfileContact(user: any, profileId: string, dto: CreateProfileContactDto) {
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

      // If this is set as primary, unset other primary contacts
      if (dto.is_primary) {
        await this.databaseService.profileContact.updateMany({
          where: {
            profileId,
            is_primary: true,
            deletedAt: null,
          },
          data: {
            is_primary: false,
          },
        });
      }

      const contact = await this.databaseService.profileContact.create({
        data: {
          profileId,
          label: dto.label,
          phone_number: dto.phone_number,
          is_primary: dto.is_primary || false,
          is_visible: dto.is_visible !== undefined ? dto.is_visible : true,
        },
      });

      return {
        success: true,
        message: 'Profile contact created successfully',
        data: {
          contact,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getAllProfileContacts(
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

      const [contacts, total] = await Promise.all([
        this.databaseService.profileContact.findMany({
          where,
          skip,
          take: perPage,
          orderBy,
        }),
        this.databaseService.profileContact.count({ where }),
      ]);

      return {
        success: true,
        message: 'Profile contacts retrieved successfully',
        data: {
          contacts,
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

  async getProfileContactById(user: any, profileId: string, contactId: string) {
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

      const contact = await this.databaseService.profileContact.findFirst({
        where: {
          id: contactId,
          profileId,
          deletedAt: null,
        },
      });

      if (!contact) {
        return {
          success: false,
          message: 'Profile contact not found',
        };
      }

      return {
        success: true,
        message: 'Profile contact retrieved successfully',
        data: {
          contact,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async updateProfileContact(
    user: any,
    profileId: string,
    contactId: string,
    dto: UpdateProfileContactDto
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

      const contact = await this.databaseService.profileContact.findFirst({
        where: {
          id: contactId,
          profileId,
          deletedAt: null,
        },
      });

      if (!contact) {
        return {
          success: false,
          message: 'Profile contact not found',
        };
      }

      // If setting as primary, unset other primary contacts
      if (dto.is_primary === true) {
        await this.databaseService.profileContact.updateMany({
          where: {
            profileId,
            id: { not: contactId },
            is_primary: true,
            deletedAt: null,
          },
          data: {
            is_primary: false,
          },
        });
      }

      const updatedContact = await this.databaseService.profileContact.update({
        where: { id: contactId },
        data: {
          label: dto.label,
          phone_number: dto.phone_number,
          is_primary: dto.is_primary,
          is_visible: dto.is_visible,
        },
      });

      return {
        success: true,
        message: 'Profile contact updated successfully',
        data: {
          contact: updatedContact,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async deleteProfileContact(user: any, profileId: string, contactId: string) {
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

      const contact = await this.databaseService.profileContact.findFirst({
        where: {
          id: contactId,
          profileId,
          deletedAt: null,
        },
      });

      if (!contact) {
        return {
          success: false,
          message: 'Profile contact not found',
        };
      }

      await this.databaseService.profileContact.update({
        where: { id: contactId },
        data: {
          deletedAt: new Date(),
        },
      });

      return {
        success: true,
        message: 'Profile contact deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async restoreProfileContact(user: any, profileId: string, contactId: string) {
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

      const contact = await this.databaseService.profileContact.findFirst({
        where: {
          id: contactId,
          profileId,
        },
      });

      if (!contact) {
        return {
          success: false,
          message: 'Profile contact not found',
        };
      }

      const restoredContact = await this.databaseService.profileContact.update({
        where: { id: contactId },
        data: {
          deletedAt: null,
        },
      });

      return {
        success: true,
        message: 'Profile contact restored successfully',
        data: {
          contact: restoredContact,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async toggleVisibility(user: any, profileId: string, contactId: string, isVisible: boolean) {
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

      const contact = await this.databaseService.profileContact.findFirst({
        where: {
          id: contactId,
          profileId,
          deletedAt: null,
        },
      });

      if (!contact) {
        return {
          success: false,
          message: 'Profile contact not found',
        };
      }

      const updatedContact = await this.databaseService.profileContact.update({
        where: { id: contactId },
        data: {
          is_visible: isVisible,
        },
      });

      return {
        success: true,
        message: 'Profile contact visibility updated successfully',
        data: {
          contact: updatedContact,
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

      await this.databaseService.profileContact.updateMany({
        where,
        data: {
          deletedAt: new Date(),
        },
      });

      return {
        success: true,
        message: 'Profile contacts deleted successfully',
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

      await this.databaseService.profileContact.updateMany({
        where,
        data: {
          deletedAt: null,
        },
      });

      return {
        success: true,
        message: 'Profile contacts restored successfully',
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

      await this.databaseService.profileContact.updateMany({
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
        message: 'Profile contacts visibility updated successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async setPrimaryContact(user: any, profileId: string, contactId: string) {
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

      const contact = await this.databaseService.profileContact.findFirst({
        where: {
          id: contactId,
          profileId,
          deletedAt: null,
        },
      });

      if (!contact) {
        return {
          success: false,
          message: 'Profile contact not found',
        };
      }

      // Unset all other primary contacts
      await this.databaseService.profileContact.updateMany({
        where: {
          profileId,
          id: { not: contactId },
          is_primary: true,
          deletedAt: null,
        },
        data: {
          is_primary: false,
        },
      });

      // Set this contact as primary
      const updatedContact = await this.databaseService.profileContact.update({
        where: { id: contactId },
        data: {
          is_primary: true,
        },
      });

      return {
        success: true,
        message: 'Primary contact set successfully',
        data: {
          contact: updatedContact,
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

