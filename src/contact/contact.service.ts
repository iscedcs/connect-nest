import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';

@Injectable()
export class ContactService {
  constructor(private readonly databaseService: DatabaseService) {}

  async leaveContact(dto: CreateContactDto) {
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

      const contact = await this.databaseService.contact.create({
        data: {
          ownerId: dto.profileId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone,
          note: dto.note,
        },
      });

      return {
        success: true,
        message: 'Contact information submitted successfully',
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

  async getReceivedContacts(user: any, page: number = 1, limit: number = 10) {
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

      const contacts = await this.databaseService.contact.findMany({
        where: {
          ownerId: profile.id,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      });

      const total = await this.databaseService.contact.count({
        where: {
          ownerId: profile.id,
          deletedAt: null,
        },
      });

      return {
        success: true,
        message: 'Received contacts retrieved successfully',
        data: {
          contacts,
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

  async getContact(user: any, contactId: string) {
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

      const contact = await this.databaseService.contact.findFirst({
        where: {
          id: contactId,
          ownerId: profile.id,
          deletedAt: null,
        },
      });

      if (!contact) {
        return {
          success: false,
          message: 'Contact not found',
        };
      }

      return {
        success: true,
        message: 'Contact retrieved successfully',
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

  async deleteContact(user: any, contactId: string) {
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

      const contact = await this.databaseService.contact.findFirst({
        where: {
          id: contactId,
          ownerId: profile.id,
          deletedAt: null,
        },
      });

      if (!contact) {
        return {
          success: false,
          message: 'Contact not found',
        };
      }

      // Soft delete the contact
      await this.databaseService.contact.update({
        where: { id: contactId },
        data: {
          deletedAt: new Date(),
        },
      });

      return {
        success: true,
        message: 'Contact deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async searchReceivedContacts(user: any, searchTerm: string, page: number = 1, limit: number = 10) {
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

      const contacts = await this.databaseService.contact.findMany({
        where: {
          ownerId: profile.id,
          deletedAt: null,
          OR: [
            {
              firstName: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
            {
              lastName: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
            {
              email: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
            {
              phone: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
            {
              note: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
          ],
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      });

      const total = await this.databaseService.contact.count({
        where: {
          ownerId: profile.id,
          deletedAt: null,
          OR: [
            {
              firstName: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
            {
              lastName: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
            {
              email: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
            {
              phone: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
            {
              note: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
          ],
        },
      });

      return {
        success: true,
        message: 'Contacts retrieved successfully',
        data: {
          contacts,
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

  async getRecentContacts(user: any, limit: number = 5) {
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

      const contacts = await this.databaseService.contact.findMany({
        where: {
          ownerId: profile.id,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return {
        success: true,
        message: 'Recent contacts retrieved successfully',
        data: {
          contacts,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getContactStats(user: any) {
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

      const totalContacts = await this.databaseService.contact.count({
        where: {
          ownerId: profile.id,
          deletedAt: null,
        },
      });

      const contactsWithEmail = await this.databaseService.contact.count({
        where: {
          ownerId: profile.id,
          email: {
            not: null,
          },
          deletedAt: null,
        },
      });

      const contactsWithPhone = await this.databaseService.contact.count({
        where: {
          ownerId: profile.id,
          phone: {
            not: null,
          },
          deletedAt: null,
        },
      });

      const contactsWithNotes = await this.databaseService.contact.count({
        where: {
          ownerId: profile.id,
          note: {
            not: null,
          },
          deletedAt: null,
        },
      });

      const todayContacts = await this.databaseService.contact.count({
        where: {
          ownerId: profile.id,
          deletedAt: null,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      });

      const thisWeekContacts = await this.databaseService.contact.count({
        where: {
          ownerId: profile.id,
          deletedAt: null,
          createdAt: {
            gte: new Date(new Date().setDate(new Date().getDate() - 7)),
          },
        },
      });

      return {
        success: true,
        message: 'Contact statistics retrieved successfully',
        data: {
          stats: {
            totalContacts,
            contactsWithEmail,
            contactsWithPhone,
            contactsWithNotes,
            todayContacts,
            thisWeekContacts,
            completionRate: totalContacts > 0 ? Math.round((contactsWithEmail + contactsWithPhone) / (totalContacts * 2) * 100) : 0,
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
