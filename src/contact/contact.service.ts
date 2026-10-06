import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { DatabaseService } from 'src/database/database.service';
import { CreateContactDto } from './dto/contact.dto';
import { NotificationDispatcher } from 'src/notification/notification-dispatcher.service';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly httpService: HttpService,
    private readonly notifications: NotificationDispatcher,
  ) {}

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

      // Try to find an existing profile for the person leaving contact
      let contactProfileId: string | null = null;
      let status: 'PENDING' | 'ACCEPTED' = 'PENDING';

      if (dto.email) {
        contactProfileId = await this.findProfileByEmail(dto.email);
      }
      if (!contactProfileId && dto.phone) {
        contactProfileId = await this.findProfileByPhone(dto.phone);
      }

      // If the person has a profile, auto-accept
      if (contactProfileId) {
        status = 'ACCEPTED';
      }

      const contact = await this.databaseService.contact.create({
        data: {
          ownerId: dto.profileId,
          contactProfileId,
          status,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone,
          note: dto.note,
        },
        include: {
          contactProfile: contactProfileId
            ? {
                select: {
                  id: true,
                  slug: true,
                  name: true,
                  profilePhoto: true,
                  coverPhoto: true,
                  position: true,
                  description: true,
                  location: true,
                },
              }
            : false,
        },
      });

      // Notify the profile owner that someone left their contact
      const contactName =
        [dto.firstName, dto.lastName].filter(Boolean).join(' ') || 'Someone';
      this.databaseService.profile
        .findUnique({
          where: { id: dto.profileId },
          select: { userId: true },
        })
        .then((p) => {
          if (p?.userId) {
            this.notifications
              .dispatch({
                userId: p.userId,
                profileId: dto.profileId,
                type: 'CONTACT_SAVED',
                title: 'New Contact Received',
                message: `${contactName} just left their contact information on your profile.`,
                data: { contactId: contact.id },
                actionUrl: '/connect/contacts',
                actionLabel: 'View Contact',
              })
              .catch(() => {});
          }
        })
        .catch(() => {});

      return {
        success: true,
        message: contactProfileId
          ? 'Contact exchanged and auto-accepted — profile linked'
          : 'Contact information submitted successfully',
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

  /**
   * Look up a user's profile by email via isce-auth check-email endpoint.
   * Returns the profileId if found, null otherwise.
   */
  private async findProfileByEmail(email: string): Promise<string | null> {
    try {
      const authApiUrl = process.env.AUTH_API_URL;
      if (!authApiUrl) return null;

      const { data: res } = await firstValueFrom(
        this.httpService.post(`${authApiUrl}/auth/check-email`, { email }),
      );

      if (!res?.data?.exists || !res?.data?.userId) return null;

      const profile = await this.databaseService.profile.findFirst({
        where: { userId: res.data.userId, deletedAt: null },
        select: { id: true },
      });

      return profile?.id ?? null;
    } catch (error) {
      this.logger.warn(`Failed to look up profile by email: ${error.message}`);
      return null;
    }
  }

  /**
   * Look up a user's profile by phone via isce-auth check-phone endpoint.
   * Returns the profileId if found, null otherwise.
   */
  private async findProfileByPhone(phone: string): Promise<string | null> {
    try {
      const authApiUrl = process.env.AUTH_API_URL;
      if (!authApiUrl) return null;

      const { data: res } = await firstValueFrom(
        this.httpService.post(`${authApiUrl}/auth/check-phone`, { phone }),
      );

      if (!res?.data?.exists || !res?.data?.userId) return null;

      const profile = await this.databaseService.profile.findFirst({
        where: { userId: res.data.userId, deletedAt: null },
        select: { id: true },
      });

      return profile?.id ?? null;
    } catch (error) {
      this.logger.warn(`Failed to look up profile by phone: ${error.message}`);
      return null;
    }
  }

  async getReceivedContacts(
    user: any,
    profileId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    try {
      // Verify the profile belongs to the user
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

      const skip = (page - 1) * limit;

      const contactProfileSelect = {
        id: true,
        slug: true,
        name: true,
        profilePhoto: true,
        coverPhoto: true,
        position: true,
        description: true,
        location: true,
      };

      const contacts = await this.databaseService.contact.findMany({
        where: {
          ownerId: profile.id,
          deletedAt: null,
        },
        include: { contactProfile: { select: contactProfileSelect } },
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

  async getContact(user: any, profileId: string, contactId: string) {
    try {
      // Verify the profile belongs to the user
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

      const contact = await this.databaseService.contact.findFirst({
        where: {
          id: contactId,
          ownerId: profile.id,
          deletedAt: null,
        },
        include: {
          contactProfile: {
            select: {
              id: true,
              slug: true,
              name: true,
              profilePhoto: true,
              coverPhoto: true,
              position: true,
              description: true,
              location: true,
            },
          },
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

  async deleteContact(user: any, profileId: string, contactId: string) {
    try {
      // Verify the profile belongs to the user
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

  async searchReceivedContacts(
    user: any,
    profileId: string,
    searchTerm: string,
    page: number = 1,
    limit: number = 10,
  ) {
    try {
      // Verify the profile belongs to the user
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
        include: {
          contactProfile: {
            select: {
              id: true,
              slug: true,
              name: true,
              profilePhoto: true,
              coverPhoto: true,
              position: true,
              description: true,
              location: true,
            },
          },
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

  async getRecentContacts(user: any, profileId: string, limit: number = 5) {
    try {
      // Verify the profile belongs to the user
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

      const contacts = await this.databaseService.contact.findMany({
        where: {
          ownerId: profile.id,
          deletedAt: null,
        },
        include: {
          contactProfile: {
            select: {
              id: true,
              slug: true,
              name: true,
              profilePhoto: true,
              coverPhoto: true,
              position: true,
              description: true,
              location: true,
            },
          },
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

  async getContactStats(user: any, profileId: string) {
    try {
      // Verify the profile belongs to the user
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
            completionRate:
              totalContacts > 0
                ? Math.round(
                    ((contactsWithEmail + contactsWithPhone) /
                      (totalContacts * 2)) *
                      100,
                  )
                : 0,
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

  async exportContacts(user: any, profileId: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const contacts = await this.databaseService.contact.findMany({
        where: { ownerId: profile.id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });

      return {
        success: true,
        message: 'Contacts exported successfully',
        data: {
          count: contacts.length,
          contacts: contacts.map((c) => ({
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
            email: c.email,
            phone: c.phone,
            note: c.note,
            status: c.status,
            createdAt: c.createdAt,
          })),
        },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}
