import { Test, TestingModule } from '@nestjs/testing';
import { CpAuditLogService } from './cp-audit-log.service';
import { DatabaseService } from '../../database/database.service';
import { createHash } from 'crypto';

describe('CpAuditLogService', () => {
  let service: CpAuditLogService;
  let db: any;

  beforeEach(async () => {
    db = {
      cpAuditLog: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CpAuditLogService,
        { provide: DatabaseService, useValue: db },
      ],
    }).compile();

    service = module.get<CpAuditLogService>(CpAuditLogService);
  });

  const calculateHash = (
    previousHash: string | null,
    createdAt: Date,
    actorId: string | null,
    eventType: string,
    targetEntity: string,
    targetEntityId: string,
    action: string,
  ): string => {
    const hashInput = [
      previousHash ?? '',
      createdAt.toISOString(),
      actorId ?? '',
      eventType,
      targetEntity,
      targetEntityId,
      action,
    ].join('|');
    return createHash('sha256').update(hashInput).digest('hex');
  };

  describe('verifyChain', () => {
    const mockCtx = { workspaceId: 'ws-1' } as any;

    it('returns valid: true for an empty log chain', async () => {
      db.cpAuditLog.findMany.mockResolvedValue([]);

      const result = await service.verifyChain(mockCtx);

      expect(result.valid).toBe(true);
      expect(result.totalRecords).toBe(0);
      expect(result.brokenLinks).toEqual([]);
    });

    it('returns valid: true for an intact, untampered audit log chain', async () => {
      const date1 = new Date('2026-07-21T10:00:00.000Z');
      const date2 = new Date('2026-07-21T10:05:00.000Z');

      const hash1 = calculateHash(
        null,
        date1,
        'user-1',
        'EVENT_1',
        'Entity',
        'id-1',
        'CREATE',
      );

      const hash2 = calculateHash(
        hash1,
        date2,
        'user-1',
        'EVENT_2',
        'Entity',
        'id-2',
        'UPDATE',
      );

      const mockLogs = [
        {
          id: 'log-1',
          createdAt: date1,
          actorId: 'user-1',
          eventType: 'EVENT_1',
          targetEntity: 'Entity',
          targetEntityId: 'id-1',
          action: 'CREATE',
          hash: hash1,
          previousHash: null,
        },
        {
          id: 'log-2',
          createdAt: date2,
          actorId: 'user-1',
          eventType: 'EVENT_2',
          targetEntity: 'Entity',
          targetEntityId: 'id-2',
          action: 'UPDATE',
          hash: hash2,
          previousHash: hash1,
        },
      ];

      db.cpAuditLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.verifyChain(mockCtx);

      expect(result.valid).toBe(true);
      expect(result.totalRecords).toBe(2);
      expect(result.brokenLinks).toEqual([]);
    });

    it('returns valid: false and identifies broken links when a record is tampered with', async () => {
      const date1 = new Date('2026-07-21T10:00:00.000Z');
      const date2 = new Date('2026-07-21T10:05:00.000Z');

      const hash1 = calculateHash(
        null,
        date1,
        'user-1',
        'EVENT_1',
        'Entity',
        'id-1',
        'CREATE',
      );

      const hash2 = calculateHash(
        hash1,
        date2,
        'user-1',
        'EVENT_2',
        'Entity',
        'id-2',
        'UPDATE',
      );

      // Create logs but tamper with the second log's action (change 'UPDATE' to 'DELETE')
      const mockLogs = [
        {
          id: 'log-1',
          createdAt: date1,
          actorId: 'user-1',
          eventType: 'EVENT_1',
          targetEntity: 'Entity',
          targetEntityId: 'id-1',
          action: 'CREATE',
          hash: hash1,
          previousHash: null,
        },
        {
          id: 'log-2',
          createdAt: date2,
          actorId: 'user-1',
          eventType: 'EVENT_2',
          targetEntity: 'Entity',
          targetEntityId: 'id-2',
          action: 'DELETE', // <-- TAMPERED! (Expected UPDATE)
          hash: hash2,
          previousHash: hash1,
        },
      ];

      db.cpAuditLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.verifyChain(mockCtx);

      expect(result.valid).toBe(false);
      expect(result.totalRecords).toBe(2);
      expect(result.brokenLinks.length).toBe(1);
      expect(result.brokenLinks[0]).toEqual({
        id: 'log-2',
        index: 1,
        reason: 'Hash recomputation mismatch',
      });
    });
  });
});
