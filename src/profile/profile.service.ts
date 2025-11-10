import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreateProfileDto, UpdateProfileDto, CloneProfileDto } from './dto/profile.dto';

@Injectable()
export class ProfileService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createProfile(user: any, dto: CreateProfileDto) {
    try {
      // Check if this is the first profile for the user
      const existingProfiles = await this.databaseService.profile.findMany({
        where: { userId: user.id, deletedAt: null },
      });

      // If this is the first profile, set it as default
      const isDefault = existingProfiles.length === 0;

      const profile = await this.databaseService.profile.create({
        data: {
          userId: user.id,
          name: dto.name,
          position: dto.position,
          description: dto.description,
          location: dto.location,
          address: dto.address,
          profilePhoto: dto.profilePhoto,
          coverPhoto: dto.coverPhoto,
          is_default: isDefault,
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
      // Get the default profile for the user
      const profile = await this.databaseService.profile.findFirst({
        where: { userId: user.id, is_default: true, deletedAt: null },
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
      // Get the default profile for the user
      const profile = await this.databaseService.profile.findFirst({
        where: { userId: user.id, is_default: true, deletedAt: null },
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
      // Get the default profile for the user
      const profile = await this.databaseService.profile.findFirst({
        where: { userId: user.id, is_default: true, deletedAt: null },
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
        data: {
          status: 'deleted',
        },
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
      // Get the default profile for the user
      const profile = await this.databaseService.profile.findFirst({
        where: { userId: user.id, is_default: true, deletedAt: null },
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

  // Multi-Profile Methods
  async getAllProfiles(user: any, page: number = 1, perPage: number = 25, includeDeleted: boolean = false) {
    try {
      const skip = (page - 1) * perPage;
      const where: any = { userId: user.id };
      
      if (!includeDeleted) {
        where.deletedAt = null;
      }

      const [profiles, total] = await Promise.all([
        this.databaseService.profile.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { createdAt: 'desc' },
        }),
        this.databaseService.profile.count({ where }),
      ]);

      return {
        success: true,
        message: 'Profiles retrieved successfully',
        data: {
          profiles,
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

  async getProfileById(user: any, profileId: string) {
    try {
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

  async updateProfileById(user: any, profileId: string, dto: UpdateProfileDto) {
    try {
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

      const updatedProfile = await this.databaseService.profile.update({
        where: { id: profileId },
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

  async deleteProfileById(user: any, profileId: string) {
    try {
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

      await this.databaseService.profile.update({
        where: { id: profileId },
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

  async restoreProfile(user: any, profileId: string) {
    try {
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

      const restoredProfile = await this.databaseService.profile.update({
        where: { id: profileId },
        data: {
          deletedAt: null,
        },
      });

      return {
        success: true,
        message: 'Profile restored successfully',
        data: {
          profile: restoredProfile,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async setDefaultProfile(user: any, profileId: string) {
    try {
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

      // Unset all other default profiles for this user
      await this.databaseService.profile.updateMany({
        where: {
          userId: user.id,
          is_default: true,
        },
        data: {
          is_default: false,
        },
      });

      // Set this profile as default
      const updatedProfile = await this.databaseService.profile.update({
        where: { id: profileId },
        data: {
          is_default: true,
        },
      });

      return {
        success: true,
        message: 'Default profile set successfully',
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

  async getDefaultProfile(user: any) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: {
          userId: user.id,
          is_default: true,
          deletedAt: null,
        },
      });

      if (!profile) {
        return {
          success: false,
          message: 'Default profile not found',
        };
      }

      return {
        success: true,
        message: 'Default profile retrieved successfully',
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

  async cloneProfile(user: any, profileId: string, dto: CloneProfileDto) {
    try {
      const sourceProfile = await this.databaseService.profile.findFirst({
        where: {
          id: profileId,
          userId: user.id,
          deletedAt: null,
        },
        include: {
          socials: { where: { deletedAt: null } },
          profileContacts: { where: { deletedAt: null } },
          links: { where: { deletedAt: null } },
          videos: { where: { deletedAt: null } },
          meetings: { where: { deletedAt: null } },
          appointments: { where: { deletedAt: null } },
          spotifyItems: { where: { deletedAt: null } },
          files: { where: { deletedAt: null } },
          forms: { where: { deletedAt: null } },
          wallets: { where: { deletedAt: null } },
          connectConfig: true,
        },
      });

      if (!sourceProfile) {
        return {
          success: false,
          message: 'Source profile not found',
        };
      }

      // Create new profile
      const newProfile = await this.databaseService.profile.create({
        data: {
          userId: user.id,
          name: dto.name || `${sourceProfile.name} - Copy`,
          position: sourceProfile.position,
          description: sourceProfile.description,
          location: sourceProfile.location,
          address: sourceProfile.address,
          profilePhoto: sourceProfile.profilePhoto,
          coverPhoto: sourceProfile.coverPhoto,
          is_default: false,
        },
      });

      const include = dto.include || {};

      // Clone resources if specified
      if (include.social && sourceProfile.socials.length > 0) {
        await this.databaseService.social.createMany({
          data: sourceProfile.socials.map(s => ({
            userId: newProfile.id,
            platform: s.platform,
            label: s.label,
            value: s.value,
            is_visible: s.is_visible,
            order: s.order,
          })),
        });
      }

      if (include.contacts && sourceProfile.profileContacts.length > 0) {
        await this.databaseService.profileContact.createMany({
          data: sourceProfile.profileContacts.map(c => ({
            profileId: newProfile.id,
            label: c.label,
            phone_number: c.phone_number,
            is_primary: false, // Reset primary status
            is_visible: c.is_visible,
          })),
        });
      }

      if (include.links && sourceProfile.links.length > 0) {
        await this.databaseService.link.createMany({
          data: sourceProfile.links.map(l => ({
            profileId: newProfile.id,
            title: l.title,
            url: l.url,
            image: l.image,
            order: l.order,
            is_visible: l.is_visible,
          })),
        });
      }

      if (include.videos && sourceProfile.videos.length > 0) {
        await this.databaseService.video.createMany({
          data: sourceProfile.videos.map(v => ({
            profileId: newProfile.id,
            title: v.title,
            platform: v.platform,
            url: v.url,
            is_featured: false, // Reset featured status
            is_visible: v.is_visible,
          })),
        });
      }

      if (include.meetings && sourceProfile.meetings.length > 0) {
        await this.databaseService.meetingLink.createMany({
          data: sourceProfile.meetings.map(m => ({
            profileId: newProfile.id,
            provider: m.provider,
            url: m.url,
            label: m.label,
            is_default: false, // Reset default status
            is_visible: m.is_visible,
          })),
        });
      }

      if (include.appointments && sourceProfile.appointments.length > 0) {
        await this.databaseService.appointmentLink.createMany({
          data: sourceProfile.appointments.map(a => ({
            profileId: newProfile.id,
            provider: a.provider,
            url: a.url,
            label: a.label,
            is_default: false, // Reset default status
            is_visible: a.is_visible,
          })),
        });
      }

      if (include.spotify && sourceProfile.spotifyItems.length > 0) {
        await this.databaseService.spotifyItem.createMany({
          data: sourceProfile.spotifyItems.map(s => ({
            profileId: newProfile.id,
            type: s.type,
            external_url: s.external_url,
            title: s.title,
            is_visible: s.is_visible,
            order: s.order,
          })),
        });
      }

      if (include.files && sourceProfile.files.length > 0) {
        await this.databaseService.fileItem.createMany({
          data: sourceProfile.files.map(f => ({
            profileId: newProfile.id,
            filename: f.filename,
            storage_key: f.storage_key,
            media_type: f.media_type,
            size_bytes: f.size_bytes,
            checksum: f.checksum,
            spaces_url: f.spaces_url,
            is_visible: f.is_visible,
          })),
        });
      }

      if (include.forms && sourceProfile.forms.length > 0) {
        for (const form of sourceProfile.forms) {
          await this.databaseService.form.create({
            data: {
              profileId: newProfile.id,
              title: form.title,
              description: form.description,
              form_type: form.form_type,
              template_id: form.template_id,
              status: form.status,
              fields: form.fields,
              is_visible: form.is_visible,
            },
          });
        }
      }

      if (include.wallets && sourceProfile.wallets.length > 0) {
        await this.databaseService.wallet.createMany({
          data: sourceProfile.wallets.map(w => ({
            profileId: newProfile.id,
            network: w.network,
            address: w.address,
            label: w.label,
            ens: w.ens,
            is_default: false, // Reset default status
            is_visible: w.is_visible,
          })),
        });
      }

      if (include.connectConfig && sourceProfile.connectConfig) {
        await this.databaseService.connectConfig.create({
          data: {
            profileId: newProfile.id,
            modules: sourceProfile.connectConfig.modules,
            theme: sourceProfile.connectConfig.theme,
            branding: sourceProfile.connectConfig.branding,
          },
        });
      }

      return {
        success: true,
        message: 'Profile cloned successfully',
        data: {
          profile: newProfile,
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
