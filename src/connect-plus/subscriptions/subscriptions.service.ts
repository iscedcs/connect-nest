import { Injectable, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CpAuditLogService } from '../audit-logs/cp-audit-log.service';
import { CpRequestContext } from '../types/cp-request.types';
import {
  CpSubscriptionPlan,
  CpSubscriptionStatus,
} from '../../generated/prisma/client';
import { UpgradePlanDto } from './dto/upgrade-plan.dto';

type PlanLimits = {
  workspaces: number; // -1 = unlimited
  staffPerWorkspace: number;
  clientsPerWorkspace: number;
};

const PLAN_LIMITS: Record<CpSubscriptionPlan, PlanLimits> = {
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

@Injectable()
export class CpSubscriptionsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auditLog: CpAuditLogService,
  ) {}

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
    const sub = await this.db.cpSubscription.findUnique({
      where: { organizationId },
    });

    const plan: CpSubscriptionPlan = sub?.plan ?? CpSubscriptionPlan.FREE;
    const limits = PLAN_LIMITS[plan];
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
}
