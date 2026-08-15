import { Test, TestingModule } from '@nestjs/testing';
import { SystemConfigService } from './system-config.service';
import { DatabaseService } from '../database/database.service';
import { SubscriptionBypassMode } from './dto/system-config.dto';

describe('SystemConfigService', () => {
  let service: SystemConfigService;
  let db: jest.Mocked<DatabaseService>;

  const mockDefaultConfig = {
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
    const mockDb = {
      systemConfig: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemConfigService,
        { provide: DatabaseService, useValue: mockDb },
      ],
    }).compile();

    service = module.get<SystemConfigService>(SystemConfigService);
    db = module.get(DatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getConfig', () => {
    it('should return existing config from DB and cache it', async () => {
      (db.systemConfig.findUnique as jest.Mock).mockResolvedValue(mockDefaultConfig);

      const result1 = await service.getConfig();
      expect(result1).toEqual(mockDefaultConfig);
      expect(db.systemConfig.findUnique).toHaveBeenCalledTimes(1);

      // Second call within TTL should return cached value without querying DB
      const result2 = await service.getConfig();
      expect(result2).toEqual(mockDefaultConfig);
      expect(db.systemConfig.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should seed default config if none exists in DB', async () => {
      (db.systemConfig.findUnique as jest.Mock).mockResolvedValue(null);
      (db.systemConfig.create as jest.Mock).mockResolvedValue(mockDefaultConfig);

      const result = await service.getConfig();
      expect(result).toEqual(mockDefaultConfig);
      expect(db.systemConfig.create).toHaveBeenCalledWith({
        data: {
          id: 'default',
          personalSubscriptionsEnabled: true,
          connectPlusSubscriptionsEnabled: true,
          bypassMode: SubscriptionBypassMode.OPEN_ACCESS,
        },
      });
    });
  });

  describe('updateConfig', () => {
    it('should update config and invalidate cache', async () => {
      (db.systemConfig.findUnique as jest.Mock).mockResolvedValue(mockDefaultConfig);

      const updatedConfig = {
        ...mockDefaultConfig,
        personalSubscriptionsEnabled: false,
        updatedBy: 'usr_super_admin',
      };
      (db.systemConfig.upsert as jest.Mock).mockResolvedValue(updatedConfig);

      const result = await service.updateConfig(
        { personalSubscriptionsEnabled: false },
        'usr_super_admin',
      );

      expect(result.personalSubscriptionsEnabled).toBe(false);
      expect(db.systemConfig.upsert).toHaveBeenCalledWith({
        where: { id: 'default' },
        update: expect.objectContaining({
          personalSubscriptionsEnabled: false,
          updatedBy: 'usr_super_admin',
        }),
        create: expect.objectContaining({
          personalSubscriptionsEnabled: false,
        }),
      });

      // Subsequent query should return updated cached value
      const isPersonalEnabled = await service.isPersonalSubscriptionEnabled();
      expect(isPersonalEnabled).toBe(false);

      const isBypassed = await service.isPersonalBypassed();
      expect(isBypassed).toBe(true);
    });
  });

  describe('isConnectPlusBypassed', () => {
    it('should return true when connectPlusSubscriptionsEnabled is false and mode is OPEN_ACCESS', async () => {
      (db.systemConfig.findUnique as jest.Mock).mockResolvedValue({
        ...mockDefaultConfig,
        connectPlusSubscriptionsEnabled: false,
        bypassMode: SubscriptionBypassMode.OPEN_ACCESS,
      });

      const bypassed = await service.isConnectPlusBypassed();
      expect(bypassed).toBe(true);
    });

    it('should return false when connectPlusSubscriptionsEnabled is false but mode is FREE_TIER_ONLY', async () => {
      (db.systemConfig.findUnique as jest.Mock).mockResolvedValue({
        ...mockDefaultConfig,
        connectPlusSubscriptionsEnabled: false,
        bypassMode: SubscriptionBypassMode.FREE_TIER_ONLY,
      });

      const bypassed = await service.isConnectPlusBypassed();
      expect(bypassed).toBe(false);
    });
  });
});
