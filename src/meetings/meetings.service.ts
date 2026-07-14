import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import {
  CreateMeetingDto,
  UpdateMeetingDto,
  BulkVisibilityDto,
  BulkDeleteDto,
  BulkRestoreDto,
} from './dto/meeting.dto';

@Injectable()
export class MeetingsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createMeeting(user: any, profileId: string, dto: CreateMeetingDto) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });

      if (!profile) {
        return { success: false, message: 'Profile not found' };
      }

      const meeting = await this.databaseService.meetingLink.create({
        data: {
          profileId,
          provider: dto.provider,
          url: dto.url,
          label: dto.label,
          is_default: false,
          is_visible: dto.is_visible !== undefined ? dto.is_visible : true,
        },
      });

      return {
        success: true,
        message: 'Meeting created successfully',
        data: { meeting },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getAllMeetings(
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

      if (!profile) {
        return { success: false, message: 'Profile not found' };
      }

      const skip = (page - 1) * perPage;
      const where: any = { profileId };
      if (!includeDeleted) where.deletedAt = null;

      const orderBy: any = sort ? { [sort]: order } : { createdAt: order };

      const [meetings, total] = await Promise.all([
        this.databaseService.meetingLink.findMany({
          where,
          skip,
          take: perPage,
          orderBy: [orderBy],
        }),
        this.databaseService.meetingLink.count({ where }),
      ]);

      return {
        success: true,
        message: 'Meetings retrieved successfully',
        data: {
          meetings,
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

  async getMeetingById(user: any, profileId: string, meetingId: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id },
      });

      if (!profile) {
        return { success: false, message: 'Profile not found' };
      }

      const meeting = await this.databaseService.meetingLink.findFirst({
        where: { id: meetingId, profileId, deletedAt: null },
      });

      if (!meeting) {
        return { success: false, message: 'Meeting not found' };
      }

      return {
        success: true,
        message: 'Meeting retrieved successfully',
        data: { meeting },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async updateMeeting(
    user: any,
    profileId: string,
    meetingId: string,
    dto: UpdateMeetingDto,
  ) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });

      if (!profile) {
        return { success: false, message: 'Profile not found' };
      }

      const meeting = await this.databaseService.meetingLink.findFirst({
        where: { id: meetingId, profileId, deletedAt: null },
      });

      if (!meeting) {
        return { success: false, message: 'Meeting not found' };
      }

      const updatedMeeting = await this.databaseService.meetingLink.update({
        where: { id: meetingId },
        data: {
          provider: dto.provider,
          url: dto.url,
          label: dto.label,
          is_visible: dto.is_visible,
        },
      });

      return {
        success: true,
        message: 'Meeting updated successfully',
        data: { meeting: updatedMeeting },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async deleteMeeting(user: any, profileId: string, meetingId: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });

      if (!profile) {
        return { success: false, message: 'Profile not found' };
      }

      const meeting = await this.databaseService.meetingLink.findFirst({
        where: { id: meetingId, profileId, deletedAt: null },
      });

      if (!meeting) {
        return { success: false, message: 'Meeting not found' };
      }

      await this.databaseService.meetingLink.update({
        where: { id: meetingId },
        data: { deletedAt: new Date() },
      });

      return { success: true, message: 'Meeting deleted successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async restoreMeeting(user: any, profileId: string, meetingId: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id },
      });

      if (!profile) {
        return { success: false, message: 'Profile not found' };
      }

      const meeting = await this.databaseService.meetingLink.findFirst({
        where: { id: meetingId, profileId },
      });

      if (!meeting) {
        return { success: false, message: 'Meeting not found' };
      }

      const restoredMeeting = await this.databaseService.meetingLink.update({
        where: { id: meetingId },
        data: { deletedAt: null },
      });

      return {
        success: true,
        message: 'Meeting restored successfully',
        data: { meeting: restoredMeeting },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async toggleVisibility(
    user: any,
    profileId: string,
    meetingId: string,
    isVisible: boolean,
  ) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });

      if (!profile) {
        return { success: false, message: 'Profile not found' };
      }

      const meeting = await this.databaseService.meetingLink.findFirst({
        where: { id: meetingId, profileId, deletedAt: null },
      });

      if (!meeting) {
        return { success: false, message: 'Meeting not found' };
      }

      const updatedMeeting = await this.databaseService.meetingLink.update({
        where: { id: meetingId },
        data: { is_visible: isVisible },
      });

      return {
        success: true,
        message: 'Meeting visibility updated successfully',
        data: { meeting: updatedMeeting },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async setDefaultMeeting(user: any, profileId: string, meetingId: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });

      if (!profile) {
        return { success: false, message: 'Profile not found' };
      }

      const meeting = await this.databaseService.meetingLink.findFirst({
        where: { id: meetingId, profileId, deletedAt: null },
      });

      if (!meeting) {
        return { success: false, message: 'Meeting not found' };
      }

      await this.databaseService.meetingLink.updateMany({
        where: {
          profileId,
          id: { not: meetingId },
          is_default: true,
          deletedAt: null,
        },
        data: { is_default: false },
      });

      const updatedMeeting = await this.databaseService.meetingLink.update({
        where: { id: meetingId },
        data: { is_default: true },
      });

      return {
        success: true,
        message: 'Default meeting set successfully',
        data: { meeting: updatedMeeting },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getDefaultMeeting(user: any, profileId: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });

      if (!profile) {
        return { success: false, message: 'Profile not found' };
      }

      const meeting = await this.databaseService.meetingLink.findFirst({
        where: { profileId, is_default: true, deletedAt: null },
      });

      if (!meeting) {
        return { success: false, message: 'Default meeting not found' };
      }

      return {
        success: true,
        message: 'Default meeting retrieved successfully',
        data: { meeting },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getMeetingsByProvider(user: any, profileId: string, provider: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });

      if (!profile) {
        return { success: false, message: 'Profile not found' };
      }

      const meetings = await this.databaseService.meetingLink.findMany({
        where: { profileId, provider: provider, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });

      return {
        success: true,
        message: 'Meetings retrieved successfully',
        data: { meetings },
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

      if (!profile) {
        return { success: false, message: 'Profile not found' };
      }

      const where: any = { profileId, deletedAt: null };
      if (dto.ids && dto.ids.length > 0) where.id = { in: dto.ids };

      await this.databaseService.meetingLink.updateMany({
        where,
        data: { deletedAt: new Date() },
      });

      return { success: true, message: 'Meetings deleted successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async bulkRestore(user: any, profileId: string, dto: BulkRestoreDto) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id },
      });

      if (!profile) {
        return { success: false, message: 'Profile not found' };
      }

      const where: any = { profileId, deletedAt: { not: null } };
      if (dto.ids && dto.ids.length > 0) where.id = { in: dto.ids };

      await this.databaseService.meetingLink.updateMany({
        where,
        data: { deletedAt: null },
      });

      return { success: true, message: 'Meetings restored successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async bulkVisibility(user: any, profileId: string, dto: BulkVisibilityDto) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });

      if (!profile) {
        return { success: false, message: 'Profile not found' };
      }

      await this.databaseService.meetingLink.updateMany({
        where: { profileId, id: { in: dto.ids }, deletedAt: null },
        data: { is_visible: dto.is_visible },
      });

      return {
        success: true,
        message: 'Meetings visibility updated successfully',
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}
