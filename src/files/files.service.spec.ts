import { Test, TestingModule } from '@nestjs/testing';
import { FilesService } from './files.service';
import { DatabaseService } from '../database/database.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PlanLimitException } from '../subscriptions/exceptions/plan-limit.exception';

describe('FilesService', () => {
  let service: FilesService;
  let db: any;
  let subscriptionsService: any;

  const mockUser = { id: 'usr_owner_123' };
  const mockOtherUser = { id: 'usr_stranger_456' };
  const profileId = 'prof_abc_789';

  beforeEach(async () => {
    db = {
      profile: {
        findFirst: jest.fn(),
      },
      fileItem: {
        count: jest.fn(),
        aggregate: jest.fn(),
        create: jest.fn(),
      },
    };

    subscriptionsService = {
      getUserLimits: jest.fn().mockResolvedValue({
        files: 5,
        storageBytes: 50 * 1024 * 1024, // 50MB
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: DatabaseService, useValue: db },
        { provide: SubscriptionsService, useValue: subscriptionsService },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
  });

  describe('generatePresignedUploadUrl', () => {
    const dto = {
      filename: 'document.pdf',
      media_type: 'application/pdf',
      size_bytes: 1024 * 1024, // 1MB
    };

    it('should deny access when profile does not belong to user (cross-user isolation)', async () => {
      db.profile.findFirst.mockResolvedValue(null);

      const result = await service.generatePresignedUploadUrl(mockOtherUser, profileId, dto);
      expect(result).toEqual({ success: false, message: 'Profile not found' });
      expect(db.profile.findFirst).toHaveBeenCalledWith({
        where: { id: profileId, userId: mockOtherUser.id, deletedAt: null },
      });
    });

    it('should generate presigned upload URL when owner owns profile and is within limits', async () => {
      db.profile.findFirst.mockResolvedValue({ id: profileId, userId: mockUser.id });
      db.fileItem.count.mockResolvedValue(2);
      db.fileItem.aggregate.mockResolvedValue({ _sum: { size_bytes: 5 * 1024 * 1024 } });

      const result = await service.generatePresignedUploadUrl(mockUser, profileId, dto);
      expect(result.success).toBe(true);
      expect(result.data.upload_url).toBeDefined();
      expect(result.data.storage_key).toContain(`profiles/${profileId}/files/`);
    });

    it('should throw PlanLimitException when files count exceeds plan limit', async () => {
      db.profile.findFirst.mockResolvedValue({ id: profileId, userId: mockUser.id });
      db.fileItem.count.mockResolvedValue(5); // At limit of 5

      await expect(
        service.generatePresignedUploadUrl(mockUser, profileId, dto),
      ).rejects.toThrow(PlanLimitException);
    });

    it('should throw PlanLimitException when total storage size exceeds limit', async () => {
      db.profile.findFirst.mockResolvedValue({ id: profileId, userId: mockUser.id });
      db.fileItem.count.mockResolvedValue(2);
      db.fileItem.aggregate.mockResolvedValue({ _sum: { size_bytes: 49.5 * 1024 * 1024 } }); // 49.5MB used

      const largeDto = {
        filename: 'video.mp4',
        media_type: 'video/mp4',
        size_bytes: 2 * 1024 * 1024, // 2MB + 49.5MB > 50MB
      };

      await expect(
        service.generatePresignedUploadUrl(mockUser, profileId, largeDto),
      ).rejects.toThrow(PlanLimitException);
    });
  });
});
