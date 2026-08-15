import { Test, TestingModule } from '@nestjs/testing';
import { CpSubscriptionsService } from './subscriptions.service';
import { DatabaseService } from '../../database/database.service';
import { CpAuditLogService } from '../audit-logs/cp-audit-log.service';
import { SystemConfigService } from '../../system-config/system-config.service';
import { ForbiddenException } from '@nestjs/common';
import { CpSubscriptionPlan } from '../../generated/prisma/client';

describe('CpSubscriptionsService', () => {
  let service: CpSubscriptionsService;
  let db: jest.Mocked<DatabaseService>;
  let systemConfigService: jest.Mocked<Partial<SystemConfigService>>;

  beforeEach(async () => {
    const mockDb = {
      cpSubscription: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      cpPlan: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      cpWorkspace: {
        count: jest.fn(),
      },
      cpWorkspaceMember: {
        count: jest.fn(),
      },
      cpLead: {
        count: jest.fn(),
      },
      cpClient: {
        count: jest.fn(),
      },
    };

    const mockAuditLog = {
      write: jest.fn(),
    };

    systemConfigService = {
      isConnectPlusSubscriptionEnabled: jest.fn().mockResolvedValue(true),
      isConnectPlusBypassed: jest.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CpSubscriptionsService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: CpAuditLogService, useValue: mockAuditLog },
        { provide: SystemConfigService, useValue: systemConfigService },
      ],
    }).compile();

    service = module.get<CpSubscriptionsService>(CpSubscriptionsService);
    db = module.get(DatabaseService);
  });

  describe('checkLimit', () => {
    it('should return unlimited (limit: -1, allowed: true) when bypassed in OPEN_ACCESS mode', async () => {
      (systemConfigService.isConnectPlusBypassed as jest.Mock).mockResolvedValue(
        true,
      );

      const result = await service.checkLimit('org_123', 'workspace');
      expect(result).toEqual({ allowed: true, limit: -1, current: 0 });
      expect(db.cpWorkspace.count).not.toHaveBeenCalled();
    });

    it('should enforce limits when subscriptions are active', async () => {
      (systemConfigService.isConnectPlusBypassed as jest.Mock).mockResolvedValue(
        false,
      );
      (db.cpSubscription.findUnique as jest.Mock).mockResolvedValue({
        plan: CpSubscriptionPlan.FREE,
      });
      (db.cpPlan.findUnique as jest.Mock).mockResolvedValue(null); // Fallback to code defaults
      (db.cpWorkspace.count as jest.Mock).mockResolvedValue(1);

      const result = await service.checkLimit('org_123', 'workspace');
      expect(result).toEqual({ allowed: false, limit: 1, current: 1 });
    });

    it('should use custom dynamic limits from database when available', async () => {
      (systemConfigService.isConnectPlusBypassed as jest.Mock).mockResolvedValue(
        false,
      );
      (db.cpSubscription.findUnique as jest.Mock).mockResolvedValue({
        plan: CpSubscriptionPlan.FREE,
      });
      (db.cpPlan.findUnique as jest.Mock).mockResolvedValue({
        key: CpSubscriptionPlan.FREE,
        limits: { workspaces: 5, staffPerWorkspace: 20, clientsPerWorkspace: 50 },
      });
      (db.cpWorkspace.count as jest.Mock).mockResolvedValue(2);

      const result = await service.checkLimit('org_custom', 'workspace');
      expect(result).toEqual({ allowed: true, limit: 5, current: 2 });
    });
  });

  describe('adminUpdatePlan', () => {
    it('should upsert dynamic plan and return updated limits', async () => {
      (db.cpPlan.findUnique as jest.Mock).mockResolvedValue(null);
      (db.cpPlan.upsert as jest.Mock).mockResolvedValue({
        id: 'plan_1',
        key: CpSubscriptionPlan.STARTER,
        name: 'Starter Pro',
        priceMonthly: 600000,
        isActive: true,
        limits: { workspaces: 5, staffPerWorkspace: 25, clientsPerWorkspace: 150 },
      });

      const result = await service.adminUpdatePlan(CpSubscriptionPlan.STARTER, {
        name: 'Starter Pro',
        priceMonthly: 600000,
        limits: { workspaces: 5 },
      });

      expect(result.name).toBe('Starter Pro');
      expect(result.resolvedLimits.workspaces).toBe(5);
    });
  });

  describe('upgrade', () => {
    it('should throw ForbiddenException if Connect Plus subscriptions are disabled', async () => {
      (
        systemConfigService.isConnectPlusSubscriptionEnabled as jest.Mock
      ).mockResolvedValue(false);

      await expect(
        service.upgrade(
          { organizationId: 'org_123' } as any,
          { plan: CpSubscriptionPlan.STARTER } as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
