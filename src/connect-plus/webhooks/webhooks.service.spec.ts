import { Test, TestingModule } from '@nestjs/testing';
import { CpWebhooksService } from './webhooks.service';
import { DatabaseService } from '../../database/database.service';
import { CpAuditLogService } from '../audit-logs/cp-audit-log.service';
import { CpNotificationsService } from '../notifications/notifications.service';
import { CpSubscriptionsService } from '../subscriptions/subscriptions.service';
import { CpInvoicesService } from '../invoices/invoices.service';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac } from 'crypto';

describe('CpWebhooksService - handleInviteAccepted', () => {
  let service: CpWebhooksService;
  let db: any;
  let auditLog: any;
  let notifications: any;

  const testSecret = 'whsec_test_secret_abc123';
  const rawToken = 'raw_invite_token_12345';
  const hashedToken = createHash('sha256').update(rawToken).digest('hex');

  const validDto = {
    email: 'newstaff@company.com',
    token: rawToken,
    authUserId: 'usr_auth_789',
    role: 'STAFF',
    workspaceId: 'ws_test_456',
  };

  const rawBody = Buffer.from(JSON.stringify(validDto));
  const validSignature = createHmac('sha256', testSecret).update(rawBody).digest('hex');

  beforeEach(async () => {
    process.env.AUTH_INVITE_WEBHOOK_SECRET = testSecret;

    const mockTx = {
      cpWorkspaceInvite: { update: jest.fn().mockResolvedValue({ id: 'inv_1', status: 'ACCEPTED' }) },
      cpWorkspaceMember: { create: jest.fn().mockResolvedValue({ id: 'mem_1', role: 'STAFF' }) },
      cpStaffProfile: { create: jest.fn().mockResolvedValue({ id: 'staff_1' }) },
      cpConversation: { findFirst: jest.fn().mockResolvedValue({ id: 'conv_1' }) },
      cpConversationParticipant: { create: jest.fn().mockResolvedValue({ id: 'part_1' }) },
    };

    db = {
      cpWorkspaceInvite: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockTx)),
      cpSubscription: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    auditLog = { write: jest.fn() };
    notifications = { send: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CpWebhooksService,
        { provide: DatabaseService, useValue: db },
        { provide: CpAuditLogService, useValue: auditLog },
        { provide: CpNotificationsService, useValue: notifications },
        { provide: CpSubscriptionsService, useValue: {} },
        { provide: CpInvoicesService, useValue: {} },
      ],
    }).compile();

    service = module.get<CpWebhooksService>(CpWebhooksService);
  });

  it('should successfully accept invite when signature and token are valid', async () => {
    db.cpWorkspaceInvite.findFirst.mockResolvedValue({
      id: 'inv_1',
      token: hashedToken,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 86400000),
      workspaceId: validDto.workspaceId,
      email: validDto.email,
      role: 'STAFF',
    });

    await expect(
      service.handleInviteAccepted(validDto, validSignature, rawBody),
    ).resolves.not.toThrow();

    expect(db.cpWorkspaceInvite.findFirst).toHaveBeenCalledWith({
      where: { token: hashedToken },
    });
    expect(auditLog.write).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'WEBHOOK_INVITE_ACCEPTED',
        success: true,
      }),
    );
  });

  it('should reject when signature is tampered or invalid', async () => {
    const invalidSignature = 'invalid_tampered_signature_hex';

    await expect(
      service.handleInviteAccepted(validDto, invalidSignature, rawBody),
    ).rejects.toThrow(UnauthorizedException);

    expect(auditLog.write).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'WEBHOOK_INVITE_ACCEPTED',
        success: false,
      }),
    );
  });

  it('should throw BadRequestException if invite is not PENDING', async () => {
    db.cpWorkspaceInvite.findFirst.mockResolvedValue({
      id: 'inv_1',
      token: hashedToken,
      status: 'ACCEPTED',
      expiresAt: new Date(Date.now() + 86400000),
      workspaceId: validDto.workspaceId,
      email: validDto.email,
    });

    await expect(
      service.handleInviteAccepted(validDto, validSignature, rawBody),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if invite has expired', async () => {
    db.cpWorkspaceInvite.findFirst.mockResolvedValue({
      id: 'inv_1',
      token: hashedToken,
      status: 'PENDING',
      expiresAt: new Date(Date.now() - 86400000),
      workspaceId: validDto.workspaceId,
      email: validDto.email,
    });

    await expect(
      service.handleInviteAccepted(validDto, validSignature, rawBody),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException on email or workspace mismatch', async () => {
    db.cpWorkspaceInvite.findFirst.mockResolvedValue({
      id: 'inv_1',
      token: hashedToken,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 86400000),
      workspaceId: 'different_ws_id',
      email: validDto.email,
    });

    await expect(
      service.handleInviteAccepted(validDto, validSignature, rawBody),
    ).rejects.toThrow(BadRequestException);
  });
});
