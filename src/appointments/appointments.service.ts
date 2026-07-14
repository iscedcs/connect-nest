import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
  BulkVisibilityDto,
  BulkDeleteDto,
  BulkRestoreDto,
} from './dto/appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createAppointment(
    user: any,
    profileId: string,
    dto: CreateAppointmentDto,
  ) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const appointment = await this.databaseService.appointmentLink.create({
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
        message: 'Appointment created successfully',
        data: { appointment },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getAllAppointments(
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

      const [appointments, total] = await Promise.all([
        this.databaseService.appointmentLink.findMany({
          where,
          skip,
          take: perPage,
          orderBy: [orderBy],
        }),
        this.databaseService.appointmentLink.count({ where }),
      ]);

      return {
        success: true,
        message: 'Appointments retrieved successfully',
        data: {
          appointments,
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

  async getAppointmentById(
    user: any,
    profileId: string,
    appointmentId: string,
  ) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const appointment = await this.databaseService.appointmentLink.findFirst({
        where: { id: appointmentId, profileId, deletedAt: null },
      });
      if (!appointment)
        return { success: false, message: 'Appointment not found' };

      return {
        success: true,
        message: 'Appointment retrieved successfully',
        data: { appointment },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async updateAppointment(
    user: any,
    profileId: string,
    appointmentId: string,
    dto: UpdateAppointmentDto,
  ) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const appointment = await this.databaseService.appointmentLink.findFirst({
        where: { id: appointmentId, profileId, deletedAt: null },
      });
      if (!appointment)
        return { success: false, message: 'Appointment not found' };

      const updatedAppointment =
        await this.databaseService.appointmentLink.update({
          where: { id: appointmentId },
          data: {
            provider: dto.provider,
            url: dto.url,
            label: dto.label,
            is_visible: dto.is_visible,
          },
        });
      return {
        success: true,
        message: 'Appointment updated successfully',
        data: { appointment: updatedAppointment },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async deleteAppointment(user: any, profileId: string, appointmentId: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const appointment = await this.databaseService.appointmentLink.findFirst({
        where: { id: appointmentId, profileId, deletedAt: null },
      });
      if (!appointment)
        return { success: false, message: 'Appointment not found' };

      await this.databaseService.appointmentLink.update({
        where: { id: appointmentId },
        data: { deletedAt: new Date() },
      });
      return { success: true, message: 'Appointment deleted successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async restoreAppointment(
    user: any,
    profileId: string,
    appointmentId: string,
  ) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const appointment = await this.databaseService.appointmentLink.findFirst({
        where: { id: appointmentId, profileId },
      });
      if (!appointment)
        return { success: false, message: 'Appointment not found' };

      const restoredAppointment =
        await this.databaseService.appointmentLink.update({
          where: { id: appointmentId },
          data: { deletedAt: null },
        });
      return {
        success: true,
        message: 'Appointment restored successfully',
        data: { appointment: restoredAppointment },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async toggleVisibility(
    user: any,
    profileId: string,
    appointmentId: string,
    isVisible: boolean,
  ) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const appointment = await this.databaseService.appointmentLink.findFirst({
        where: { id: appointmentId, profileId, deletedAt: null },
      });
      if (!appointment)
        return { success: false, message: 'Appointment not found' };

      const updatedAppointment =
        await this.databaseService.appointmentLink.update({
          where: { id: appointmentId },
          data: { is_visible: isVisible },
        });
      return {
        success: true,
        message: 'Appointment visibility updated successfully',
        data: { appointment: updatedAppointment },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async setDefaultAppointment(
    user: any,
    profileId: string,
    appointmentId: string,
  ) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const appointment = await this.databaseService.appointmentLink.findFirst({
        where: { id: appointmentId, profileId, deletedAt: null },
      });
      if (!appointment)
        return { success: false, message: 'Appointment not found' };

      await this.databaseService.appointmentLink.updateMany({
        where: {
          profileId,
          id: { not: appointmentId },
          is_default: true,
          deletedAt: null,
        },
        data: { is_default: false },
      });
      const updatedAppointment =
        await this.databaseService.appointmentLink.update({
          where: { id: appointmentId },
          data: { is_default: true },
        });
      return {
        success: true,
        message: 'Default appointment set successfully',
        data: { appointment: updatedAppointment },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getDefaultAppointment(user: any, profileId: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const appointment = await this.databaseService.appointmentLink.findFirst({
        where: { profileId, is_default: true, deletedAt: null },
      });
      if (!appointment)
        return { success: false, message: 'Default appointment not found' };

      return {
        success: true,
        message: 'Default appointment retrieved successfully',
        data: { appointment },
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

      await this.databaseService.appointmentLink.updateMany({
        where,
        data: { deletedAt: new Date() },
      });
      return { success: true, message: 'Appointments deleted successfully' };
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

      await this.databaseService.appointmentLink.updateMany({
        where,
        data: { deletedAt: null },
      });
      return { success: true, message: 'Appointments restored successfully' };
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

      await this.databaseService.appointmentLink.updateMany({
        where: { profileId, id: { in: dto.ids }, deletedAt: null },
        data: { is_visible: dto.is_visible },
      });
      return {
        success: true,
        message: 'Appointments visibility updated successfully',
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}
