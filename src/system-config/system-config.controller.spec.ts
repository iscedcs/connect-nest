import { Test, TestingModule } from '@nestjs/testing';
import { SystemConfigController } from './system-config.controller';
import { SystemConfigService } from './system-config.service';
import { SubscriptionBypassMode } from './dto/system-config.dto';

describe('SystemConfigController', () => {
  let controller: SystemConfigController;
  let service: jest.Mocked<Partial<SystemConfigService>>;

  const mockConfig = {
    id: 'default',
    personalSubscriptionsEnabled: true,
    connectPlusSubscriptionsEnabled: true,
    bypassMode: SubscriptionBypassMode.OPEN_ACCESS,
    maintenanceReason: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    service = {
      getConfig: jest.fn().mockResolvedValue(mockConfig),
      updateConfig: jest.fn().mockResolvedValue({
        ...mockConfig,
        personalSubscriptionsEnabled: false,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SystemConfigController],
      providers: [{ provide: SystemConfigService, useValue: service }],
    }).compile();

    controller = module.get<SystemConfigController>(SystemConfigController);
  });

  describe('getPublicSubscriptionStatus', () => {
    it('should return public subscription status payload', async () => {
      const response = await controller.getPublicSubscriptionStatus();
      expect(response).toEqual({
        success: true,
        data: {
          personalSubscriptionsEnabled: true,
          connectPlusSubscriptionsEnabled: true,
          bypassMode: SubscriptionBypassMode.OPEN_ACCESS,
          maintenanceReason: null,
        },
      });
    });
  });

  describe('getAdminSubscriptionConfig', () => {
    it('should return full system config for Super Admin', async () => {
      const response = await controller.getAdminSubscriptionConfig();
      expect(response).toEqual({
        success: true,
        data: { config: mockConfig },
      });
    });
  });

  describe('updateAdminSubscriptionConfig', () => {
    it('should update config and return updated payload', async () => {
      const req = { isce_auth: { id: 'admin_1' } };
      const response = await controller.updateAdminSubscriptionConfig(req, {
        personalSubscriptionsEnabled: false,
      });

      expect(service.updateConfig).toHaveBeenCalledWith(
        { personalSubscriptionsEnabled: false },
        'admin_1',
      );
      expect(response.success).toBe(true);
      expect(response.data.config.personalSubscriptionsEnabled).toBe(false);
    });
  });
});
