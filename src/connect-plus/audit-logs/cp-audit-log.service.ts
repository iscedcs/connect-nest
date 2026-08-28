import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma, CpAuditSource } from '../../generated/prisma/client';
import { DatabaseService } from '../../database/database.service';
import { CpRequestContext } from '../types/cp-request.types';
import { Request } from 'express';
import { paginateResult } from '../utils/paginate';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';
import {
  resolveActors,
  resolveTargetNames,
  buildSummary,
  EnrichedAuditLog,
} from './cp-audit-log.enricher';

export interface WriteAuditLogOptions {
  ctx: CpRequestContext | null;
  req?: Request;
  workspaceId?: string;
  organizationId?: string;
  eventType: string;
  targetEntity: string;
  targetEntityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  source?: CpAuditSource;
  success?: boolean;
  errorMessage?: string;
  actorRole?: string;
}

@Injectable()
export class CpAuditLogService {
  constructor(private readonly db: DatabaseService) {}

  write(options: WriteAuditLogOptions): void {
    const {
      ctx,
      req,
      workspaceId,
      organizationId,
      eventType,
      targetEntity,
      targetEntityId,
      action,
      before,
      after,
      metadata,
      source = CpAuditSource.API,
      success = true,
      errorMessage,
      actorRole,
    } = options;

    const isSystemEvent = ctx === null;
    const actorId = ctx?.authUserId ?? null;
    const resolvedWorkspaceId = workspaceId ?? ctx?.workspaceId ?? null;

    // Fire-and-forget async chain to maintain hash ordering
    void (async () => {
      try {
        const now = new Date();

        // Find last hash in chain for this workspace (or org-level if no workspace)
        const lastEntry = await this.db.cpAuditLog.findFirst({
          where: resolvedWorkspaceId
            ? { workspaceId: resolvedWorkspaceId }
            : {
                organizationId:
                  organizationId ?? ctx?.organizationId ?? undefined,
              },
          orderBy: { createdAt: 'desc' },
          select: { hash: true },
        });

        const previousHash = lastEntry?.hash ?? null;

        // Compute hash: SHA-256 of (previousHash + ISO-createdAt + actorId + eventType + targetEntity + targetEntityId + action)
        const hashInput = [
          previousHash ?? '',
          now.toISOString(),
          actorId ?? '',
          eventType,
          targetEntity,
          targetEntityId,
          action,
        ].join('|');
        const hash = createHash('sha256').update(hashInput).digest('hex');

        await this.db.cpAuditLog.create({
          data: {
            organizationId: organizationId ?? ctx?.organizationId ?? null,
            workspaceId: resolvedWorkspaceId,
            actorId,
            actorRole: actorRole ?? (ctx?.role as string | undefined) ?? null,
            isSystemEvent,
            eventType,
            targetEntity,
            targetEntityId,
            action,
            before: (before ?? null) as Prisma.InputJsonValue,
            after: (after ?? null) as Prisma.InputJsonValue,
            metadata: (metadata ?? null) as Prisma.InputJsonValue,
            ipAddress: req?.ip ?? null,
            userAgent:
              typeof req?.headers['user-agent'] === 'string'
                ? req.headers['user-agent']
                : null,
            source,
            success,
            errorMessage: errorMessage ?? null,
            hash,
            previousHash,
            createdAt: now,
          },
        });
      } catch {
        // Fire-and-forget: swallow all errors silently
      }
    })();
  }

  // ---------------------------------------------------------------------------
  // Read — paginated list with filters (WORKSPACE_ADMIN)
  // ---------------------------------------------------------------------------
  async list(ctx: CpRequestContext, query: ListAuditLogsQueryDto) {
    const {
      page = 1,
      limit = 20,
      entity,
      entityId,
      eventType,
      actorId,
      from,
      to,
    } = query;

    const where: Prisma.CpAuditLogWhereInput = {
      workspaceId: ctx.workspaceId,
    };

    if (entity) where.targetEntity = entity;
    if (entityId) where.targetEntityId = entityId;
    if (eventType) where.eventType = eventType;
    if (actorId) where.actorId = actorId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to + 'T23:59:59.999Z');
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.db.cpAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.db.cpAuditLog.count({ where }),
    ]);

    const enriched = await this.enrich(data);

    return paginateResult(enriched, total, page, limit);
  }

  // ---------------------------------------------------------------------------
  // Read — paginated list of own actions (STAFF, CLIENT)
  // ---------------------------------------------------------------------------
  async listMine(ctx: CpRequestContext, query: ListAuditLogsQueryDto) {
    const {
      page = 1,
      limit = 20,
      entity,
      entityId,
      eventType,
      from,
      to,
    } = query;

    const where: Prisma.CpAuditLogWhereInput = {
      workspaceId: ctx.workspaceId,
      actorId: ctx.authUserId,
    };

    if (entity) where.targetEntity = entity;
    if (entityId) where.targetEntityId = entityId;
    if (eventType) where.eventType = eventType;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to + 'T23:59:59.999Z');
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.db.cpAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.db.cpAuditLog.count({ where }),
    ]);

    const enriched = await this.enrich(data);

    return paginateResult(enriched, total, page, limit);
  }

  // ---------------------------------------------------------------------------
  // Read — paginated list with PII scrubbed (CREATOR)
  // ---------------------------------------------------------------------------
  async listOrg(ctx: CpRequestContext, query: ListAuditLogsQueryDto) {
    const {
      page = 1,
      limit = 20,
      entity,
      entityId,
      eventType,
      actorId,
      from,
      to,
    } = query;

    const where: Prisma.CpAuditLogWhereInput = {
      organizationId: ctx.organizationId,
    };

    if (entity) where.targetEntity = entity;
    if (entityId) where.targetEntityId = entityId;
    if (eventType) where.eventType = eventType;
    if (actorId) where.actorId = actorId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to + 'T23:59:59.999Z');
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.db.cpAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          createdAt: true,
          organizationId: true,
          workspaceId: true,
          actorId: true,
          actorRole: true,
          isSystemEvent: true,
          eventType: true,
          targetEntity: true,
          targetEntityId: true,
          action: true,
          success: true,
          errorMessage: true,
          source: true,
          hash: true,
          previousHash: true,
        },
      }),
      this.db.cpAuditLog.count({ where }),
    ]);

    const enriched = await this.enrich(data);

    return paginateResult(enriched, total, page, limit);
  }

  // ---------------------------------------------------------------------------
  // Private helper — batch enrichment of audit log rows
  // ---------------------------------------------------------------------------
  private async enrich(rows: any[]): Promise<EnrichedAuditLog[]> {
    if (!rows || rows.length === 0) return [];

    const actorIds = rows
      .map((r) => r.actorId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    const targets = rows.map((r) => ({
      entity: r.targetEntity,
      entityId: r.targetEntityId,
    }));

    const [actorMap, targetMap] = await Promise.all([
      resolveActors(this.db, actorIds),
      resolveTargetNames(this.db, targets),
    ]);

    return rows.map((row) => {
      const isSystem = row.isSystemEvent || !row.actorId;
      const actorInfo = row.actorId ? actorMap.get(row.actorId) : undefined;
      const actorName = isSystem
        ? 'System'
        : (actorInfo?.name ?? 'Unknown User');
      const actorEmail = isSystem ? null : (actorInfo?.email ?? null);

      const targetKey = `${row.targetEntity}:${row.targetEntityId}`;
      const targetName = targetMap.get(targetKey) ?? null;

      const summary = buildSummary(actorName, row.eventType, targetName);

      return {
        ...row,
        actorName,
        actorEmail,
        targetName,
        summary,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Export audit logs as CSV (WORKSPACE_ADMIN)
  // ---------------------------------------------------------------------------
  async exportCsv(
    ctx: CpRequestContext,
    query: ListAuditLogsQueryDto,
  ): Promise<string> {
    const { entity, entityId, eventType, actorId, from, to } = query;

    const where: Prisma.CpAuditLogWhereInput = {
      workspaceId: ctx.workspaceId,
    };
    if (entity) where.targetEntity = entity;
    if (entityId) where.targetEntityId = entityId;
    if (eventType) where.eventType = eventType;
    if (actorId) where.actorId = actorId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to + 'T23:59:59.999Z');
    }

    const rows = await this.db.cpAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const header =
      'id,createdAt,actorId,actorRole,isSystemEvent,eventType,targetEntity,targetEntityId,action,success,errorMessage,ipAddress,source\n';

    const lines = rows.map((r) =>
      [
        r.id,
        r.createdAt.toISOString(),
        r.actorId ?? '',
        r.actorRole ?? '',
        r.isSystemEvent,
        r.eventType,
        r.targetEntity,
        r.targetEntityId,
        r.action,
        r.success,
        r.errorMessage ?? '',
        r.ipAddress ?? '',
        r.source,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );

    return header + lines.join('\n');
  }

  // ---------------------------------------------------------------------------
  // Verify hash chain integrity (WORKSPACE_ADMIN)
  // ---------------------------------------------------------------------------
  async verifyChain(ctx: CpRequestContext): Promise<{
    valid: boolean;
    totalRecords: number;
    brokenLinks: Array<{ id: string; index: number; reason: string }>;
  }> {
    const workspaceId = ctx.workspaceId!;

    const rows = await this.db.cpAuditLog.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        createdAt: true,
        actorId: true,
        eventType: true,
        targetEntity: true,
        targetEntityId: true,
        action: true,
        hash: true,
        previousHash: true,
      },
    });

    const brokenLinks: Array<{ id: string; index: number; reason: string }> =
      [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      if (!row.hash) {
        brokenLinks.push({ id: row.id, index: i, reason: 'Missing hash' });
        continue;
      }

      const expectedPreviousHash = i === 0 ? null : (rows[i - 1].hash ?? null);
      if (row.previousHash !== expectedPreviousHash) {
        brokenLinks.push({
          id: row.id,
          index: i,
          reason: `Previous hash mismatch (expected ${expectedPreviousHash ?? 'null'}, got ${row.previousHash ?? 'null'})`,
        });
        continue;
      }

      const hashInput = [
        row.previousHash ?? '',
        row.createdAt.toISOString(),
        row.actorId ?? '',
        row.eventType,
        row.targetEntity,
        row.targetEntityId,
        row.action,
      ].join('|');
      const expectedHash = createHash('sha256').update(hashInput).digest('hex');

      if (row.hash !== expectedHash) {
        brokenLinks.push({
          id: row.id,
          index: i,
          reason: 'Hash recomputation mismatch',
        });
      }
    }

    return {
      valid: brokenLinks.length === 0,
      totalRecords: rows.length,
      brokenLinks,
    };
  }
}
