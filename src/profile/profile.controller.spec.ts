import { Test, TestingModule } from '@nestjs/testing';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { NotFoundException } from '@nestjs/common';

describe('ProfileController - Public Endpoints', () => {
  let controller: ProfileController;
  let service: jest.Mocked<Partial<ProfileService>>;

  beforeEach(async () => {
    service = {
      getPublicProfileByDeviceId: jest.fn(),
      getPublicProfileBySlug: jest.fn(),
      getProfileWalletCard: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [{ provide: ProfileService, useValue: service }],
    }).compile();

    controller = module.get<ProfileController>(ProfileController);
  });

  describe('GET /profile/public/:deviceId', () => {
    it('should return public profile data for a valid linked deviceId', async () => {
      const mockResult = {
        success: true,
        data: {
          id: 'prof_123',
          name: 'Jane Doe',
          position: 'Lead Designer',
          links: [{ id: 'lnk_1', title: 'Portfolio', url: 'https://jane.design' }],
        },
      };
      (service.getPublicProfileByDeviceId as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.getPublicProfile('NFC_DEV_999');
      expect(result).toEqual(mockResult);
      expect(service.getPublicProfileByDeviceId).toHaveBeenCalledWith('NFC_DEV_999');
    });

    it('should throw or return error when device is not linked or not found', async () => {
      (service.getPublicProfileByDeviceId as jest.Mock).mockRejectedValue(
        new NotFoundException('Device not found or not linked to an active profile'),
      );

      await expect(controller.getPublicProfile('UNKNOWN_DEV')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('GET /profile/slug/:slug', () => {
    it('should return public profile data for a valid slug', async () => {
      const mockResult = {
        success: true,
        data: {
          id: 'prof_456',
          name: 'John Smith',
          position: 'Software Engineer',
        },
      };
      (service.getPublicProfileBySlug as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.getPublicProfileBySlug('john-smith');
      expect(result).toEqual(mockResult);
      expect(service.getPublicProfileBySlug).toHaveBeenCalledWith('john-smith');
    });
  });
});
