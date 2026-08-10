import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class DeviceProfileService {
  constructor(private readonly prisma: DatabaseService) {}

  /**
   * Link a device to a profile.
   * A device can only be linked to one profile at a time.
   * The profile must belong to the authenticated user.
   */
  async linkDevice(user: any, profileId: string, deviceId: string) {
    // Verify the profile belongs to this user
    const profile = await this.prisma.profile.findFirst({
      where: { id: profileId, userId: user.id, deletedAt: null },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found or not owned by you');
    }

    // Check if device is already linked to another profile
    const existing = await this.prisma.deviceProfile.findUnique({
      where: { deviceId },
    });

    if (existing) {
      // If already linked to this profile, return it
      if (existing.profileId === profileId) {
        return {
          success: true,
          message: 'Device is already linked to this profile',
          data: existing,
        };
      }

      // If linked to a different profile of the same user, update it
      const otherProfile = await this.prisma.profile.findFirst({
        where: { id: existing.profileId, userId: user.id },
      });

      if (!otherProfile) {
        throw new ConflictException(
          'This device is linked to a profile belonging to another user',
        );
      }

      // Relink to the new profile
      const updated = await this.prisma.deviceProfile.update({
        where: { deviceId },
        data: { profileId, linkedAt: new Date() },
      });

      return {
        success: true,
        message: 'Device relinked to the new profile',
        data: updated,
      };
    }

    // Create new link
    const link = await this.prisma.deviceProfile.create({
      data: { deviceId, profileId },
    });

    return {
      success: true,
      message: 'Device linked to profile successfully',
      data: link,
    };
  }

  /**
   * Unlink a device from a profile.
   */
  async unlinkDevice(user: any, profileId: string, deviceId: string) {
    const profile = await this.prisma.profile.findFirst({
      where: { id: profileId, userId: user.id, deletedAt: null },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found or not owned by you');
    }

    const link = await this.prisma.deviceProfile.findUnique({
      where: { deviceId },
    });

    if (!link || link.profileId !== profileId) {
      throw new NotFoundException('Device is not linked to this profile');
    }

    await this.prisma.deviceProfile.delete({
      where: { deviceId },
    });

    return {
      success: true,
      message: 'Device unlinked from profile successfully',
    };
  }

  /**
   * List all devices linked to a specific profile.
   */
  async getDevicesForProfile(user: any, profileId: string) {
    const profile = await this.prisma.profile.findFirst({
      where: { id: profileId, userId: user.id, deletedAt: null },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found or not owned by you');
    }

    const links = await this.prisma.deviceProfile.findMany({
      where: { profileId },
      orderBy: { linkedAt: 'desc' },
    });

    return {
      success: true,
      message: 'Devices retrieved successfully',
      data: links,
    };
  }

  /**
   * List all device-profile bindings for the authenticated user.
   * Returns all devices linked to any of the user's profiles.
   */
  async getAllDeviceBindings(user: any) {
    const profiles = await this.prisma.profile.findMany({
      where: { userId: user.id, deletedAt: null },
      select: { id: true, name: true, slug: true, profilePhoto: true },
    });

    const profileIds = profiles.map((p) => p.id);

    const links = await this.prisma.deviceProfile.findMany({
      where: { profileId: { in: profileIds } },
      include: {
        profile: {
          select: {
            id: true,
            name: true,
            slug: true,
            profilePhoto: true,
          },
        },
      },
      orderBy: { linkedAt: 'desc' },
    });

    return {
      success: true,
      message: 'Device bindings retrieved successfully',
      data: { profiles, bindings: links },
    };
  }

  /**
   * Find the profile linked to a device (public — used during NFC tap resolution).
   */
  async findProfileByDeviceId(deviceId: string) {
    const link = await this.prisma.deviceProfile.findUnique({
      where: { deviceId },
      include: {
        profile: {
          select: { id: true, slug: true, userId: true },
        },
      },
    });

    return link?.profile ?? null;
  }

  /**
   * [ADMIN] Reassign a device from its current profile to a new profile.
   * Bypasses user ownership checks — only callable by super admins.
   */
  async adminReassignDevice(deviceId: string, newProfileId: string) {
    // Verify the target profile exists
    const newProfile = await this.prisma.profile.findFirst({
      where: { id: newProfileId, deletedAt: null },
      select: { id: true, name: true, slug: true, userId: true },
    });

    if (!newProfile) {
      throw new NotFoundException('Target profile not found');
    }

    // Check if device is currently linked
    const existing = await this.prisma.deviceProfile.findUnique({
      where: { deviceId },
      include: {
        profile: {
          select: { id: true, name: true, slug: true, userId: true },
        },
      },
    });

    if (existing && existing.profileId === newProfileId) {
      throw new BadRequestException('Device is already linked to this profile');
    }

    const previousProfile = existing?.profile ?? null;

    if (existing) {
      // Update existing link
      const updated = await this.prisma.deviceProfile.update({
        where: { deviceId },
        data: { profileId: newProfileId, linkedAt: new Date() },
      });

      return {
        success: true,
        message: 'Device reassigned to new profile successfully',
        data: {
          binding: updated,
          previousProfile,
          newProfile,
        },
      };
    }

    // No existing link — create new one
    const link = await this.prisma.deviceProfile.create({
      data: { deviceId, profileId: newProfileId },
    });

    return {
      success: true,
      message: 'Device linked to new profile successfully',
      data: {
        binding: link,
        previousProfile: null,
        newProfile,
      },
    };
  }

  /**
   * [ADMIN] Unlink a device from its current profile without reassigning.
   */
  async adminUnlinkDevice(deviceId: string) {
    const existing = await this.prisma.deviceProfile.findUnique({
      where: { deviceId },
      include: {
        profile: {
          select: { id: true, name: true, slug: true, userId: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Device is not linked to any profile');
    }

    await this.prisma.deviceProfile.delete({
      where: { deviceId },
    });

    return {
      success: true,
      message: 'Device unlinked from profile successfully',
      data: { previousProfile: existing.profile },
    };
  }
}
