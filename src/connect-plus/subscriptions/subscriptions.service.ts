import { Injectable, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CpAuditLogService } from '../audit-logs/cp-audit-log.service';
import { CpRequestContext } from '../types/cp-request.types';
import {
  CpSubscriptionPlan,
  CpSubscriptionStatus,
} from '../../generated/prisma/client';
import { UpgradePlanDto } from './dto/upgrade-plan.dto';
import { SystemConfigService } from '../../system-config/system-config.service';

export type CpPlanLimits = {
  workspaces: number; // -1 = unlimited
  staffPerWorkspace: number;
  clientsPerWorkspace: number;
};

export const DEFAULT_CP_PLAN_LIMITS: Record<CpSubscriptionPlan, CpPlanLimits> = {
  [CpSubscriptionPlan.FREE]: {
    workspaces: 1,
    staffPerWorkspace: 5,
    clientsPerWorkspace: 20,
  },
  [CpSubscriptionPlan.STARTER]: {
    workspaces: 3,
    staffPerWorkspace: 15,
    clientsPerWorkspace: 100,
  },
  [CpSubscriptionPlan.GROWTH]: {
    workspaces: 10,
    staffPerWorkspace: 50,
    clientsPerWorkspace: -1,
  },
  [CpSubscriptionPlan.BUSINESS]: {
    workspaces: -1,
    staffPerWorkspace: -1,
    clientsPerWorkspace: -1,
  },
};

export const DEFAULT_CP_PLAN_NAMES: Record<CpSubscriptionPlan, string> = {
  [CpSubscriptionPlan.FREE]: 'Free',
  [CpSubscriptionPlan.STARTER]: 'Starter',
  [CpSubscriptionPlan.GROWTH]: 'Growth',
  [CpSubscriptionPlan.BUSINESS]: 'Business',
};

export const DEFAULT_CP_PLAN_PRICES: Record<CpSubscriptionPlan, number> = {
  [CpSubscriptionPlan.FREE]: 0,
  [CpSubscriptionPlan.STARTER]: 500000,   // ₦5,000 in kobo
  [CpSubscriptionPlan.GROWTH]: 1500000,  // ₦15,000 in kobo
  [CpSubscriptionPlan.BUSINESS]: 3500000, // ₦35,000 in kobo
};

@Injectable()
export class CpSubscriptionsService {
  private readonly cpPlanLimitsCache = new Map<CpSubscriptionPlan, CpPlanLimits>();

  constructor(
    private readonly db: DatabaseService,
    private readonly auditLog: CpAuditLogService,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  /**
   * Resolve dynamic resource quotas from a CpPlan database entity or raw object.
   */
  resolveCpPlanLimits(
    planKey: CpSubscriptionPlan,
    dbPlan?: { limits?: any } | null,
  ): CpPlanLimits {
    const defaults =
      DEFAULT_CP_PLAN_LIMITS[planKey] || DEFAULT_CP_PLAN_LIMITS.FREE;

    if (!dbPlan || !dbPlan.limits || typeof dbPlan.limits !== 'object') {
      return defaults;
    }

    const rawLimits = dbPlan.limits as Record<string, any>;
    return {
      workspaces:
        rawLimits.workspaces !== undefined
          ? rawLimits.workspaces
          : defaults.workspaces,
      staffPerWorkspace:
        rawLimits.staffPerWorkspace !== undefined
          ? rawLimits.staffPerWorkspace
          : defaults.staffPerWorkspace,
      clientsPerWorkspace:
        rawLimits.clientsPerWorkspace !== undefined
          ? rawLimits.clientsPerWorkspace
          : defaults.clientsPerWorkspace,
    };
  }

  /**
   * Resolve dynamic resource quotas for a Connect Plus plan tier from DB,
   * falling back to standard defaults if not customized yet.
   */
  async getPlanLimits(planKey: CpSubscriptionPlan): Promise<CpPlanLimits> {
    const cached = this.cpPlanLimitsCache.get(planKey);
    if (cached) return cached;

    const dbPlan = await this.db.cpPlan.findUnique({
      where: { key: planKey },
    });

    const resolved = this.resolveCpPlanLimits(planKey, dbPlan);
    this.cpPlanLimitsCache.set(planKey, resolved);
    return resolved;
  }

  async getOrCreate(ctx: CpRequestContext) {
    const existing = await this.db.cpSubscription.findUnique({
      where: { organizationId: ctx.organizationId },
    });
    if (existing) return existing;

    const now = new Date();
    const trialEndsAt = this.addMonths(now, 6);

    const sub = await this.db.cpSubscription.create({
      data: {
        organizationId: ctx.organizationId,
        plan: CpSubscriptionPlan.FREE,
        status: CpSubscriptionStatus.TRIALING,
        trialStartsAt: now,
        trialEndsAt,
        trialUsed: true,
      },
    });

    this.auditLog.write({
      ctx,
      eventType: 'SUBSCRIPTION_CREATE',
      targetEntity: 'CpSubscription',
      targetEntityId: sub.id,
      action: 'CREATE',
      success: true,
    });

    return sub;
  }

  private addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  async upgrade(ctx: CpRequestContext, dto: UpgradePlanDto) {
    const isEnabled =
      await this.systemConfigService.isConnectPlusSubscriptionEnabled();
    if (!isEnabled) {
      throw new ForbiddenException(
        'Connect Plus subscription upgrades are currently disabled by the system administrator',
      );
    }

    const sub = await this.getOrCreate(ctx);

    const updated = await this.db.cpSubscription.update({
      where: { id: sub.id },
      data: {
        plan: dto.plan,
        paystackSubCode: dto.paystackSubCode ?? sub.paystackSubCode,
        paystackCustomerCode:
          dto.paystackCustomerCode ?? sub.paystackCustomerCode,
        status: CpSubscriptionStatus.ACTIVE,
      },
    });

    this.auditLog.write({
      ctx,
      eventType: 'SUBSCRIPTION_UPGRADE',
      targetEntity: 'CpSubscription',
      targetEntityId: updated.id,
      action: 'UPDATE',
      success: true,
    });

    return updated;
  }

  async checkLimit(
    organizationId: string,
    resource: 'workspace' | 'staff' | 'client',
    workspaceId?: string,
  ): Promise<{ allowed: boolean; limit: number; current: number }> {
    if (await this.systemConfigService.isConnectPlusBypassed()) {
      return { allowed: true, limit: -1, current: 0 };
    }

    const sub = await this.db.cpSubscription.findUnique({
      where: { organizationId },
    });

    const plan: CpSubscriptionPlan = sub?.plan ?? CpSubscriptionPlan.FREE;
    const limits = await this.getPlanLimits(plan);
    let limitValue: number;
    let current: number;

    switch (resource) {
      case 'workspace': {
        limitValue = limits.workspaces;
        current = await this.db.cpWorkspace.count({
          where: { organizationId, deletedAt: null },
        });
        break;
      }

      case 'staff': {
        if (!workspaceId) {
          return { allowed: true, limit: -1, current: 0 };
        }
        limitValue = limits.staffPerWorkspace;
        current = await this.db.cpWorkspaceMember.count({
          where: {
            workspaceId,
            role: { in: ['STAFF', 'WORKSPACE_ADMIN'] as any },
            status: 'ACTIVE',
          },
        });
        break;
      }

      case 'client': {
        if (!workspaceId) {
          return { allowed: true, limit: -1, current: 0 };
        }
        limitValue = limits.clientsPerWorkspace;
        // Count both active leads + clients (non-deleted) combined
        const [leadCount, clientCount] = await Promise.all([
          this.db.cpLead.count({
            where: { workspaceId, deletedAt: null },
          }),
          this.db.cpClient.count({
            where: { workspaceId, deletedAt: null },
          }),
        ]);
        current = leadCount + clientCount;
        break;
      }
    }

    // -1 means unlimited
    if (limitValue === -1) {
      return { allowed: true, limit: -1, current };
    }

    return {
      allowed: current < limitValue,
      limit: limitValue,
      current,
    };
  }

  // ─── Super Admin Management ───────────────────────────────────────────────

  async getAllPlansAdmin() {
    const plans = await this.db.cpPlan.findMany({
      orderBy: { priceMonthly: 'asc' },
    });

    // Merge with any missing enum values if DB not fully seeded
    const allEnums = Object.values(CpSubscriptionPlan);
    const result = await Promise.all(
      allEnums.map(async (key) => {
        const found = plans.find((p) => p.key === key);
        const resolvedLimits = await this.getPlanLimits(key);
        if (found) {
          return {
            ...found,
            resolvedLimits,
          };
        }
        return {
          id: `default-${key.toLowerCase()}`,
          key,
          name: DEFAULT_CP_PLAN_NAMES[key],
          priceMonthly: DEFAULT_CP_PLAN_PRICES[key],
          isActive: true,
          limits: resolvedLimits,
          resolvedLimits,
        };
      }),
    );

    return result;
  }

  async adminUpdatePlan(
    planKey: CpSubscriptionPlan,
    dto: {
      name?: string;
      priceMonthly?: number;
      isActive?: boolean;
      limits?: Partial<CpPlanLimits>;
    },
  ) {
    const defaultLimits =
      DEFAULT_CP_PLAN_LIMITS[planKey] || DEFAULT_CP_PLAN_LIMITS.FREE;
    const defaultName = DEFAULT_CP_PLAN_NAMES[planKey] || planKey;
    const defaultPrice = DEFAULT_CP_PLAN_PRICES[planKey] || 0;

    const existing = await this.db.cpPlan.findUnique({
      where: { key: planKey },
    });

    const currentLimits = (existing?.limits as any) || defaultLimits;
    const mergedLimits = dto.limits
      ? { ...currentLimits, ...dto.limits }
      : currentLimits;

    const updated = await this.db.cpPlan.upsert({
      where: { key: planKey },
      create: {
        key: planKey,
        name: dto.name ?? defaultName,
        priceMonthly: dto.priceMonthly ?? defaultPrice,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        limits: mergedLimits,
      },
      update: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.priceMonthly !== undefined && { priceMonthly: dto.priceMonthly }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.limits !== undefined && { limits: mergedLimits }),
      },
    });

    const resolvedLimits = this.resolveCpPlanLimits(planKey, updated);
    this.cpPlanLimitsCache.set(planKey, resolvedLimits);

    return {
      ...updated,
      resolvedLimits,
    };
  }
}
