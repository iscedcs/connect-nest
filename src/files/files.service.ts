import { HttpException, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import {
  CreateFileDto,
  UpdateFileDto,
  GeneratePresignedUploadUrlDto,
  BulkVisibilityDto,
  BulkDeleteDto,
  BulkRestoreDto,
} from './dto/file.dto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PlanLimitException } from '../subscriptions/exceptions/plan-limit.exception';
import { PlanTier } from '../generated/prisma/client';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly spacesClient: S3Client | null = null;
  private readonly bucket: string;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {
    const endpoint = process.env.DO_SPACES_ENDPOINT || process.env.AWS_S3_ENDPOINT;
    const region = process.env.DO_SPACES_REGION || process.env.AWS_REGION || 'us-east-1';
    const accessKeyId = process.env.DO_SPACES_KEY || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.DO_SPACES_SECRET || process.env.AWS_SECRET_ACCESS_KEY;
    this.bucket = process.env.DO_SPACES_BUCKET || process.env.AWS_S3_BUCKET || 'isce-connect-files';

    if (accessKeyId && secretAccessKey) {
      this.spacesClient = new S3Client({
        endpoint: endpoint || undefined,
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        forcePathStyle: false,
      });
      this.logger.log('S3 / DigitalOcean Spaces client initialized');
    } else {
      this.logger.warn('S3 / DigitalOcean Spaces credentials not found; using mock presigned URLs');
    }
  }

  async generatePresignedUploadUrl(
    user: any,
    profileId: string,
    dto: GeneratePresignedUploadUrlDto,
  ) {
    try {
      const profile = await this.databaseService.profile.findFirst({
        where: { id: profileId, userId: user.id, deletedAt: null },
      });
      if (!profile) return { success: false, message: 'Profile not found' };

      // Enforce files count limit
      const limits = await this.subscriptionsService.getUserLimits(user.id);
      const currentCount = await this.databaseService.fileItem.count({
        where: { profile: { userId: user.id }, deletedAt: null },
      });
      if (currentCount >= limits.files) {
        throw new PlanLimitException('files', PlanTier.PRO_LITE);
      }

      // Enforce storage bytes limit
      if (limits.storageBytes !== Infinity) {
        const storageResult = await this.databaseService.fileItem.aggregate({
          _sum: { size_bytes: true },
          where: { profile: { userId: user.id }, deletedAt: null },
        });
        const usedBytes = storageResult._sum.size_bytes ?? 0;
        if (usedBytes + (dto.size_bytes ?? 0) > limits.storageBytes) {
          throw new PlanLimitException('storageBytes', PlanTier.PRO_LITE);
        }
      }

      const cleanFilename = dto.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storageKey = `profiles/${profileId}/files/${Date.now()}_${cleanFilename}`;
      const expiresSeconds = 900; // 15 mins

      let uploadUrl: string;
      if (this.spacesClient) {
        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
          ContentType: dto.media_type,
          ACL: 'public-read',
        });
        uploadUrl = await getSignedUrl(this.spacesClient, command, {
          expiresIn: expiresSeconds,
        });
      } else {
        uploadUrl = `https://${this.bucket}.nyc3.digitaloceanspaces.com/${storageKey}?mock_signature=true`;
      }

      const publicUrl = `https://${this.bucket}.nyc3.digitaloceanspaces.com/${storageKey}`;
      const expiresAt = new Date(Date.now() + expiresSeconds * 1000).toISOString();

      return {
        success: true,
        message: 'Presigned upload URL generated successfully',
        data: {
          upload_url: uploadUrl,
          storage_key: storageKey,
          spaces_url: publicUrl,
          expires_at: expiresAt,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      return { success: false, message: error.message };
    }
  }

  async createFile(user: any, profileId: string, dto: CreateFileDto) {
    try {
      const profile = await this.databaseService.profile.findFirst({ where: { id: profileId, userId: user.id, deletedAt: null } });
      if (!profile) return { success: false, message: 'Profile not found' };

      // Enforce files count limit (aggregate across all user profiles)
      const limits = await this.subscriptionsService.getUserLimits(user.id);
      const currentCount = await this.databaseService.fileItem.count({
        where: { profile: { userId: user.id }, deletedAt: null },
      });
      if (currentCount >= limits.files) {
        throw new PlanLimitException('files', PlanTier.PRO_LITE);
      }

      // Enforce storage bytes limit
      if (limits.storageBytes !== Infinity) {
        const storageResult = await this.databaseService.fileItem.aggregate({
          _sum: { size_bytes: true },
          where: { profile: { userId: user.id }, deletedAt: null },
        });
        const usedBytes = storageResult._sum.size_bytes ?? 0;
        if (usedBytes + (dto.size_bytes ?? 0) > limits.storageBytes) {
          throw new PlanLimitException('storageBytes', PlanTier.PRO_LITE);
        }
      }

      const file = await this.databaseService.fileItem.create({
        data: { profileId, filename: dto.filename, storage_key: dto.storage_key, media_type: dto.media_type, size_bytes: dto.size_bytes, checksum: dto.checksum, spaces_url: dto.spaces_url, is_visible: dto.is_visible !== undefined ? dto.is_visible : true },
      });
      return { success: true, message: 'File created successfully', data: { file } };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      return { success: false, message: error.message };
    }
  }

  async getAllFiles(user: any, profileId: string, page: number = 1, perPage: number = 25, includeDeleted: boolean = false, sort?: string, order: 'asc' | 'desc' = 'asc') {
    try {
      const profile = await this.databaseService.profile.findFirst({ where: { id: profileId, userId: user.id } });
      if (!profile) return { success: false, message: 'Profile not found' };

      const skip = (page - 1) * perPage;
      const where: any = { profileId };
      if (!includeDeleted) where.deletedAt = null;
      const orderBy: any = sort ? { [sort]: order } : { createdAt: order };

      const [files, total] = await Promise.all([
        this.databaseService.fileItem.findMany({ where, skip, take: perPage, orderBy: [orderBy] }),
        this.databaseService.fileItem.count({ where }),
      ]);

      return { success: true, message: 'Files retrieved successfully', data: { files, pagination: { page, per_page: perPage, total, pages: Math.ceil(total / perPage) } } };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getFileById(user: any, profileId: string, fileId: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({ where: { id: profileId, userId: user.id } });
      if (!profile) return { success: false, message: 'Profile not found' };

      const file = await this.databaseService.fileItem.findFirst({ where: { id: fileId, profileId, deletedAt: null } });
      if (!file) return { success: false, message: 'File not found' };

      return { success: true, message: 'File retrieved successfully', data: { file } };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async updateFile(user: any, profileId: string, fileId: string, dto: UpdateFileDto) {
    try {
      const profile = await this.databaseService.profile.findFirst({ where: { id: profileId, userId: user.id, deletedAt: null } });
      if (!profile) return { success: false, message: 'Profile not found' };

      const file = await this.databaseService.fileItem.findFirst({ where: { id: fileId, profileId, deletedAt: null } });
      if (!file) return { success: false, message: 'File not found' };

      const updatedFile = await this.databaseService.fileItem.update({
        where: { id: fileId },
        data: { filename: dto.filename, is_visible: dto.is_visible },
      });
      return { success: true, message: 'File updated successfully', data: { file: updatedFile } };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async deleteFile(user: any, profileId: string, fileId: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({ where: { id: profileId, userId: user.id, deletedAt: null } });
      if (!profile) return { success: false, message: 'Profile not found' };

      const file = await this.databaseService.fileItem.findFirst({ where: { id: fileId, profileId, deletedAt: null } });
      if (!file) return { success: false, message: 'File not found' };

      await this.databaseService.fileItem.update({ where: { id: fileId }, data: { deletedAt: new Date() } });
      return { success: true, message: 'File deleted successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async restoreFile(user: any, profileId: string, fileId: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({ where: { id: profileId, userId: user.id } });
      if (!profile) return { success: false, message: 'Profile not found' };

      const file = await this.databaseService.fileItem.findFirst({ where: { id: fileId, profileId } });
      if (!file) return { success: false, message: 'File not found' };

      const restoredFile = await this.databaseService.fileItem.update({ where: { id: fileId }, data: { deletedAt: null } });
      return { success: true, message: 'File restored successfully', data: { file: restoredFile } };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async toggleVisibility(user: any, profileId: string, fileId: string, isVisible: boolean) {
    try {
      const profile = await this.databaseService.profile.findFirst({ where: { id: profileId, userId: user.id, deletedAt: null } });
      if (!profile) return { success: false, message: 'Profile not found' };

      const file = await this.databaseService.fileItem.findFirst({ where: { id: fileId, profileId, deletedAt: null } });
      if (!file) return { success: false, message: 'File not found' };

      const updatedFile = await this.databaseService.fileItem.update({ where: { id: fileId }, data: { is_visible: isVisible } });
      return { success: true, message: 'File visibility updated successfully', data: { file: updatedFile } };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getFilesByType(user: any, profileId: string, type: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({ where: { id: profileId, userId: user.id, deletedAt: null } });
      if (!profile) return { success: false, message: 'Profile not found' };

      // Derive media type pattern from type category
      const mediaTypePatterns: { [key: string]: string[] } = {
        pdf: ['application/pdf'],
        image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
        doc: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        other: [],
      };

      const patterns = mediaTypePatterns[type.toLowerCase()] || [];
      const where: any = { profileId, deletedAt: null };
      
      if (patterns.length > 0) {
        where.media_type = { in: patterns };
      } else if (type.toLowerCase() === 'other') {
        where.media_type = { notIn: [...mediaTypePatterns.pdf, ...mediaTypePatterns.image, ...mediaTypePatterns.doc] };
      }

      const files = await this.databaseService.fileItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      return { success: true, message: 'Files retrieved successfully', data: { files } };
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

      const expiresSeconds = 3600; // 1 hour
      let downloadUrl: string;

      if (this.spacesClient && file.storage_key) {
        const command = new GetObjectCommand({
          Bucket: this.bucket,
          Key: file.storage_key,
        });
        downloadUrl = await getSignedUrl(this.spacesClient, command, {
          expiresIn: expiresSeconds,
        });
      } else {
        downloadUrl = file.spaces_url;
      }

      const expiresAt = new Date(Date.now() + expiresSeconds * 1000).toISOString();
      return {
        success: true,
        message: 'Download URL generated successfully',
        data: {
          download_url: downloadUrl,
          expires_at: expiresAt,
          filename: file.filename,
          media_type: file.media_type,
          size_bytes: file.size_bytes,
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

      if (forceDelete && this.spacesClient && file.storage_key) {
        try {
          const command = new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: file.storage_key,
          });
          await this.spacesClient.send(command);
        } catch (e) {
          this.logger.error(`Error deleting physical file from S3: ${e.message}`);
        }
      }

      // Permanently delete from database
      await this.databaseService.fileItem.delete({ where: { id: fileId } });

      return { success: true, message: 'File permanently deleted successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async bulkDelete(user: any, profileId: string, dto: BulkDeleteDto) {
    try {
      const profile = await this.databaseService.profile.findFirst({ where: { id: profileId, userId: user.id, deletedAt: null } });
      if (!profile) return { success: false, message: 'Profile not found' };

      const where: any = { profileId, deletedAt: null };
      if (dto.ids && dto.ids.length > 0) where.id = { in: dto.ids };

      await this.databaseService.fileItem.updateMany({ where, data: { deletedAt: new Date() } });
      return { success: true, message: 'Files deleted successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async bulkRestore(user: any, profileId: string, dto: BulkRestoreDto) {
    try {
      const profile = await this.databaseService.profile.findFirst({ where: { id: profileId, userId: user.id } });
      if (!profile) return { success: false, message: 'Profile not found' };

      const where: any = { profileId, deletedAt: { not: null } };
      if (dto.ids && dto.ids.length > 0) where.id = { in: dto.ids };

      await this.databaseService.fileItem.updateMany({ where, data: { deletedAt: null } });
      return { success: true, message: 'Files restored successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async bulkVisibility(user: any, profileId: string, dto: BulkVisibilityDto) {
    try {
      const profile = await this.databaseService.profile.findFirst({ where: { id: profileId, userId: user.id, deletedAt: null } });
      if (!profile) return { success: false, message: 'Profile not found' };

      await this.databaseService.fileItem.updateMany({ where: { profileId, id: { in: dto.ids }, deletedAt: null }, data: { is_visible: dto.is_visible } });
      return { success: true, message: 'Files visibility updated successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

