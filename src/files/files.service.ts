import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import {
  CreateFileDto,
  UpdateFileDto,
  BulkVisibilityDto,
  BulkDeleteDto,
  BulkRestoreDto,
} from './dto/file.dto';
// TODO: Import AWS SDK or Digital Ocean Spaces SDK for file operations
// import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
// import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class FilesService {
  constructor(private readonly databaseService: DatabaseService) {
    // TODO: Initialize Digital Ocean Spaces client
    // this.spacesClient = new S3Client({
    //   endpoint: process.env.DO_SPACES_ENDPOINT,
    //   region: process.env.DO_SPACES_REGION,
    //   credentials: {
    //     accessKeyId: process.env.DO_SPACES_KEY,
    //     secretAccessKey: process.env.DO_SPACES_SECRET,
    //   },
    // });
  }

  async createFile(user: any, profileId: string, dto: CreateFileDto) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const file = await this.databaseService.fileItem.create({
        data: {
          profileId,
          filename: dto.filename,
          storage_key: dto.storage_key,
          media_type: dto.media_type,
          size_bytes: dto.size_bytes,
          checksum: dto.checksum,
          spaces_url: dto.spaces_url,
          is_visible: dto.is_visible !== undefined ? dto.is_visible : true,
        },
      });
      return {
        success: true,
        message: 'File created successfully',
        data: { file },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getAllFiles(
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

      const [files, total] = await Promise.all([
        this.databaseService.fileItem.findMany({
          where,
          skip,
          take: perPage,
          orderBy: [orderBy],
        }),
        this.databaseService.fileItem.count({ where }),
      ]);

      return {
        success: true,
        message: 'Files retrieved successfully',
        data: {
          files,
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

  async getFileById(user: any, profileId: string, fileId: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const file = await this.databaseService.fileItem.findFirst({
        where: { id: fileId, profileId, deletedAt: null },
      });
      if (!file) return { success: false, message: 'File not found' };

      return {
        success: true,
        message: 'File retrieved successfully',
        data: { file },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async updateFile(
    user: any,
    profileId: string,
    fileId: string,
    dto: UpdateFileDto,
  ) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const file = await this.databaseService.fileItem.findFirst({
        where: { id: fileId, profileId, deletedAt: null },
      });
      if (!file) return { success: false, message: 'File not found' };

      const updatedFile = await this.databaseService.fileItem.update({
        where: { id: fileId },
        data: { filename: dto.filename, is_visible: dto.is_visible },
      });
      return {
        success: true,
        message: 'File updated successfully',
        data: { file: updatedFile },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async deleteFile(user: any, profileId: string, fileId: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const file = await this.databaseService.fileItem.findFirst({
        where: { id: fileId, profileId, deletedAt: null },
      });
      if (!file) return { success: false, message: 'File not found' };

      await this.databaseService.fileItem.update({
        where: { id: fileId },
        data: { deletedAt: new Date() },
      });
      return { success: true, message: 'File deleted successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async restoreFile(user: any, profileId: string, fileId: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const file = await this.databaseService.fileItem.findFirst({
        where: { id: fileId, profileId },
      });
      if (!file) return { success: false, message: 'File not found' };

      const restoredFile = await this.databaseService.fileItem.update({
        where: { id: fileId },
        data: { deletedAt: null },
      });
      return {
        success: true,
        message: 'File restored successfully',
        data: { file: restoredFile },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async toggleVisibility(
    user: any,
    profileId: string,
    fileId: string,
    isVisible: boolean,
  ) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const file = await this.databaseService.fileItem.findFirst({
        where: { id: fileId, profileId, deletedAt: null },
      });
      if (!file) return { success: false, message: 'File not found' };

      const updatedFile = await this.databaseService.fileItem.update({
        where: { id: fileId },
        data: { is_visible: isVisible },
      });
      return {
        success: true,
        message: 'File visibility updated successfully',
        data: { file: updatedFile },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getFilesByType(user: any, profileId: string, type: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      // Derive media type pattern from type category
      const mediaTypePatterns: { [key: string]: string[] } = {
        pdf: ['application/pdf'],
        image: [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/svg+xml',
        ],
        doc: [
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        other: [],
      };

      const patterns = mediaTypePatterns[type.toLowerCase()] || [];
      const where: any = { profileId, deletedAt: null };

      if (patterns.length > 0) {
        where.media_type = { in: patterns };
      } else if (type.toLowerCase() === 'other') {
        where.media_type = {
          notIn: [
            ...mediaTypePatterns.pdf,
            ...mediaTypePatterns.image,
            ...mediaTypePatterns.doc,
          ],
        };
      }

      const files = await this.databaseService.fileItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      return {
        success: true,
        message: 'Files retrieved successfully',
        data: { files },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getDownloadUrl(user: any, profileId: string, fileId: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const file = await this.databaseService.fileItem.findFirst({
        where: { id: fileId, profileId, deletedAt: null },
      });
      if (!file) return { success: false, message: 'File not found' };

      // TODO: Generate time-limited signed URL using Digital Ocean Spaces SDK
      // const command = new GetObjectCommand({
      //   Bucket: process.env.DO_SPACES_BUCKET,
      //   Key: file.storage_key,
      // });
      // const downloadUrl = await getSignedUrl(this.spacesClient, command, { expiresIn: 3600 }); // 1 hour
      // const expiresAt = new Date(Date.now() + 3600 * 1000);

      // For now, return a placeholder response
      const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour from now
      return {
        success: true,
        message: 'Download URL generated successfully',
        data: {
          download_url: file.spaces_url, // TODO: Replace with signed URL
          expires_at: expiresAt.toISOString(),
        },
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async permanentDelete(
    user: any,
    profileId: string,
    fileId: string,
    forceDelete: boolean = false,
  ) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      const file = await this.databaseService.fileItem.findFirst({
        where: { id: fileId, profileId },
      });
      if (!file) return { success: false, message: 'File not found' };

      if (forceDelete) {
        // TODO: Delete physical file from Digital Ocean Spaces
        // const command = new DeleteObjectCommand({
        //   Bucket: process.env.DO_SPACES_BUCKET,
        //   Key: file.storage_key,
        // });
        // await this.spacesClient.send(command);
      }

      // Permanently delete from database
      await this.databaseService.fileItem.delete({ where: { id: fileId } });

      return {
        success: true,
        message: 'File permanently deleted successfully',
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

      await this.databaseService.fileItem.updateMany({
        where,
        data: { deletedAt: new Date() },
      });
      return { success: true, message: 'Files deleted successfully' };
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

      await this.databaseService.fileItem.updateMany({
        where,
        data: { deletedAt: null },
      });
      return { success: true, message: 'Files restored successfully' };
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

      await this.databaseService.fileItem.updateMany({
        where: { profileId, id: { in: dto.ids }, deletedAt: null },
        data: { is_visible: dto.is_visible },
      });
      return {
        success: true,
        message: 'Files visibility updated successfully',
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}
