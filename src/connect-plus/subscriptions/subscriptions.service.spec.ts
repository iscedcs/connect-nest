import { Test, TestingModule } from '@nestjs/testing';
import { CpSubscriptionsService } from './subscriptions.service';
import { DatabaseService } from '../../database/database.service';
import { CpAuditLogService } from '../audit-logs/cp-audit-log.service';
import { SystemConfigService } from '../../system-config/system-config.service';
import { CpSubscriptionPlan, CpSubscriptionStatus } from '../../generated/prisma/client';

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

    describe('workspace resource limits', () => {
      beforeEach(() => {
        (systemConfigService.isConnectPlusBypassed as jest.Mock).mockResolvedValue(false);
        (db.cpSubscription.findUnique as jest.Mock).mockResolvedValue({
          plan: CpSubscriptionPlan.FREE,
        });
        (db.cpPlan.findUnique as jest.Mock).mockResolvedValue(null); // uses default FREE (limit: 1)
      });

      it('should allow workspace creation when under-cap (0/1)', async () => {
        (db.cpWorkspace.count as jest.Mock).mockResolvedValue(0);
        const result = await service.checkLimit('org_1', 'workspace');
        expect(result).toEqual({ allowed: true, limit: 1, current: 0 });
        expect(db.cpWorkspace.count).toHaveBeenCalledWith({
          where: { organizationId: 'org_1', deletedAt: null },
        });
      });

      it('should block workspace creation when at-cap (1/1)', async () => {
        (db.cpWorkspace.count as jest.Mock).mockResolvedValue(1);
        const result = await service.checkLimit('org_1', 'workspace');
        expect(result).toEqual({ allowed: false, limit: 1, current: 1 });
      });

      it('should block workspace creation when over-cap (2/1)', async () => {
        (db.cpWorkspace.count as jest.Mock).mockResolvedValue(2);
        const result = await service.checkLimit('org_1', 'workspace');
        expect(result).toEqual({ allowed: false, limit: 1, current: 2 });
      });
    });

    describe('staff resource limits', () => {
      beforeEach(() => {
        (systemConfigService.isConnectPlusBypassed as jest.Mock).mockResolvedValue(false);
        (db.cpSubscription.findUnique as jest.Mock).mockResolvedValue({
          plan: CpSubscriptionPlan.FREE,
        });
        (db.cpPlan.findUnique as jest.Mock).mockResolvedValue(null); // default FREE (limit: 5)
      });

      it('should allow staff invite when under-cap (4/5)', async () => {
        (db.cpWorkspaceMember.count as jest.Mock).mockResolvedValue(4);
        const result = await service.checkLimit('org_1', 'staff', 'ws_1');
        expect(result).toEqual({ allowed: true, limit: 5, current: 4 });
        expect(db.cpWorkspaceMember.count).toHaveBeenCalledWith({
          where: {
            workspaceId: 'ws_1',
            role: { in: ['STAFF', 'WORKSPACE_ADMIN'] },
            status: 'ACTIVE',
          },
        });
      });

      it('should block staff invite when at-cap (5/5)', async () => {
        (db.cpWorkspaceMember.count as jest.Mock).mockResolvedValue(5);
        const result = await service.checkLimit('org_1', 'staff', 'ws_1');
        expect(result).toEqual({ allowed: false, limit: 5, current: 5 });
      });

      it('should block staff invite when over-cap (6/5)', async () => {
        (db.cpWorkspaceMember.count as jest.Mock).mockResolvedValue(6);
        const result = await service.checkLimit('org_1', 'staff', 'ws_1');
        expect(result).toEqual({ allowed: false, limit: 5, current: 6 });
      });

      it('should return allowed: true if workspaceId is not provided', async () => {
        const result = await service.checkLimit('org_1', 'staff');
        expect(result).toEqual({ allowed: true, limit: -1, current: 0 });
      });
    });

    describe('client / lead resource limits', () => {
      beforeEach(() => {
        (systemConfigService.isConnectPlusBypassed as jest.Mock).mockResolvedValue(false);
        (db.cpSubscription.findUnique as jest.Mock).mockResolvedValue({
          plan: CpSubscriptionPlan.FREE,
        });
        (db.cpPlan.findUnique as jest.Mock).mockResolvedValue(null); // default FREE (limit: 20)
      });

      it('should allow when combined leads + clients is under-cap (10 + 5 = 15/20)', async () => {
        (db.cpLead.count as jest.Mock).mockResolvedValue(10);
        (db.cpClient.count as jest.Mock).mockResolvedValue(5);

        const result = await service.checkLimit('org_1', 'client', 'ws_1');
        expect(result).toEqual({ allowed: true, limit: 20, current: 15 });
        expect(db.cpLead.count).toHaveBeenCalledWith({
          where: { workspaceId: 'ws_1', deletedAt: null },
        });
        expect(db.cpClient.count).toHaveBeenCalledWith({
          where: { workspaceId: 'ws_1', deletedAt: null },
        });
      });

      it('should block when combined leads + clients is at-cap (12 + 8 = 20/20)', async () => {
        (db.cpLead.count as jest.Mock).mockResolvedValue(12);
        (db.cpClient.count as jest.Mock).mockResolvedValue(8);

        const result = await service.checkLimit('org_1', 'client', 'ws_1');
        expect(result).toEqual({ allowed: false, limit: 20, current: 20 });
      });

      it('should block when combined leads + clients is over-cap (15 + 10 = 25/20)', async () => {
        (db.cpLead.count as jest.Mock).mockResolvedValue(15);
        (db.cpClient.count as jest.Mock).mockResolvedValue(10);

        const result = await service.checkLimit('org_1', 'client', 'ws_1');
        expect(result).toEqual({ allowed: false, limit: 20, current: 25 });
      });
    });

    describe('unlimited plans (BUSINESS)', () => {
      beforeEach(() => {
        (systemConfigService.isConnectPlusBypassed as jest.Mock).mockResolvedValue(false);
        (db.cpSubscription.findUnique as jest.Mock).mockResolvedValue({
          plan: CpSubscriptionPlan.BUSINESS,
        });
        (db.cpPlan.findUnique as jest.Mock).mockResolvedValue(null); // default BUSINESS (-1 for all)
      });

      it('should never block workspaces regardless of count', async () => {
        (db.cpWorkspace.count as jest.Mock).mockResolvedValue(100);
        const result = await service.checkLimit('org_biz', 'workspace');
        expect(result).toEqual({ allowed: true, limit: -1, current: 100 });
      });

      it('should never block staff regardless of count', async () => {
        (db.cpWorkspaceMember.count as jest.Mock).mockResolvedValue(500);
        const result = await service.checkLimit('org_biz', 'staff', 'ws_biz');
        expect(result).toEqual({ allowed: true, limit: -1, current: 500 });
      });

      it('should never block clients regardless of count', async () => {
        (db.cpLead.count as jest.Mock).mockResolvedValue(1000);
        (db.cpClient.count as jest.Mock).mockResolvedValue(1500);
        const result = await service.checkLimit('org_biz', 'client', 'ws_biz');
        expect(result).toEqual({ allowed: true, limit: -1, current: 2500 });
      });
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

  describe('adminOverrideSubscription', () => {
    it('should update an existing subscription plan and bust the cache', async () => {
      const existingSub = { id: 'sub_1', organizationId: 'org_123' };
      const updatedSub = {
        id: 'sub_1',
        organizationId: 'org_123',
        plan: CpSubscriptionPlan.BUSINESS,
        status: CpSubscriptionStatus.ACTIVE,
      };
      (db.cpSubscription.findUnique as jest.Mock).mockResolvedValue(existingSub);
      (db.cpSubscription.update as jest.Mock).mockResolvedValue(updatedSub);

      const result = await service.adminOverrideSubscription(
        'org_123',
        { plan: CpSubscriptionPlan.BUSINESS, reason: 'Gifted upgrade' },
        'admin_456',
      );

      expect(db.cpSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub_1' },
          data: expect.objectContaining({ plan: CpSubscriptionPlan.BUSINESS }),
        }),
      );
      expect(result.plan).toBe(CpSubscriptionPlan.BUSINESS);
    });

    it('should create a new subscription when none exists', async () => {
      const createdSub = {
        id: 'sub_new',
        organizationId: 'org_new',
        plan: CpSubscriptionPlan.STARTER,
        status: CpSubscriptionStatus.ACTIVE,
      };
      (db.cpSubscription.findUnique as jest.Mock).mockResolvedValue(null);
      (db.cpSubscription.create as jest.Mock).mockResolvedValue(createdSub);

      const result = await service.adminOverrideSubscription(
        'org_new',
        { plan: CpSubscriptionPlan.STARTER },
        'admin_456',
      );

      expect(db.cpSubscription.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org_new',
            plan: CpSubscriptionPlan.STARTER,
            status: CpSubscriptionStatus.ACTIVE,
          }),
        }),
      );
      expect(result.id).toBe('sub_new');
    });
  });

  describe('getOrCreate', () => {
    it('should bootstrap a 6-month trial subscription with status TRIALING for new orgs', async () => {
      const mockCreatedSub = {
        id: 'sub_trial_1',
        organizationId: 'org_new_trial',
        plan: CpSubscriptionPlan.FREE,
        status: CpSubscriptionStatus.TRIALING,
        trialUsed: true,
        trialStartsAt: new Date('2026-08-25T00:00:00.000Z'),
        trialEndsAt: new Date('2027-02-25T00:00:00.000Z'),
      };
      (db.cpSubscription.findUnique as jest.Mock).mockResolvedValue(null);
      (db.cpSubscription.create as jest.Mock).mockResolvedValue(mockCreatedSub);

      const ctx = {
        authUserId: 'user_123',
        organizationId: 'org_new_trial',
        role: 'CREATOR' as any,
      };

      const result = await service.getOrCreate(ctx);

      expect(db.cpSubscription.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org_new_trial',
            plan: CpSubscriptionPlan.FREE,
            status: CpSubscriptionStatus.TRIALING,
            trialUsed: true,
            trialStartsAt: expect.any(Date),
            trialEndsAt: expect.any(Date),
          }),
        }),
      );

      expect(result.status).toBe(CpSubscriptionStatus.TRIALING);
      expect(result.trialUsed).toBe(true);
    });

    it('should return existing subscription if one already exists without re-initiating trial', async () => {
      const existingSub = {
        id: 'sub_existing',
        organizationId: 'org_existing',
        plan: CpSubscriptionPlan.FREE,
        status: CpSubscriptionStatus.ACTIVE,
        trialUsed: true,
      };
      (db.cpSubscription.findUnique as jest.Mock).mockResolvedValue(existingSub);

      const ctx = {
        authUserId: 'user_123',
        organizationId: 'org_existing',
        role: 'CREATOR' as any,
      };

      const result = await service.getOrCreate(ctx);

      expect(db.cpSubscription.create).not.toHaveBeenCalled();
      expect(result).toBe(existingSub);
    });
  });
});
