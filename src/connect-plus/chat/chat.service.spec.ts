import { Test, TestingModule } from '@nestjs/testing';
import { CpChatService } from './chat.service';
import { DatabaseService } from '../../database/database.service';
import { CpNotificationsService } from '../notifications/notifications.service';
import { CpAuditLogService } from '../audit-logs/cp-audit-log.service';
import { CpChatGateway } from './chat.gateway';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GetMessagesQueryDto } from './dto/get-messages-query.dto';
import { SendMessageDto } from './dto/send-message.dto';

describe('CpChatService', () => {
  let service: CpChatService;
  let db: any;
  let gateway: any;
  let notifications: any;
  let auditLog: any;

  beforeEach(async () => {
    db = {
      cpConversation: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      cpConversationParticipant: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      cpWorkspaceMember: {
        findUnique: jest.fn(),
      },
      cpMessage: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };

    gateway = {
      server: {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      },
      isUserOnline: jest.fn(),
    };

    notifications = {
      send: jest.fn(),
    };

    auditLog = {
      write: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CpChatService,
        { provide: DatabaseService, useValue: db },
        { provide: CpChatGateway, useValue: gateway },
        { provide: CpNotificationsService, useValue: notifications },
        { provide: CpAuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<CpChatService>(CpChatService);
  });

  const mockCtx = { workspaceId: 'ws-1', authUserId: 'user-1' } as any;
  const mockConvId = 'conv-1';

  describe('getMessages', () => {
    it('throws NotFoundException if conversation not found in workspace', async () => {
      db.cpConversation.findFirst.mockResolvedValue(null);
      await expect(service.getMessages(mockCtx, mockConvId, new GetMessagesQueryDto())).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if user is not a participant', async () => {
      db.cpConversation.findFirst.mockResolvedValue({ id: mockConvId, workspaceId: 'ws-1' });
      db.cpConversationParticipant.findUnique.mockResolvedValue(null);
      await expect(service.getMessages(mockCtx, mockConvId, new GetMessagesQueryDto())).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException if user has left the conversation', async () => {
      db.cpConversation.findFirst.mockResolvedValue({ id: mockConvId, workspaceId: 'ws-1' });
      db.cpConversationParticipant.findUnique.mockResolvedValue({ leftAt: new Date() });
      await expect(service.getMessages(mockCtx, mockConvId, new GetMessagesQueryDto())).rejects.toThrow(ForbiddenException);
    });

    it('returns messages if user is an active participant', async () => {
      db.cpConversation.findFirst.mockResolvedValue({ id: mockConvId, workspaceId: 'ws-1' });
      db.cpConversationParticipant.findUnique.mockResolvedValue({ leftAt: null });
      db.cpMessage.findMany.mockResolvedValue([{ id: 'msg-1', content: 'hello' }]);

      const msgs = await service.getMessages(mockCtx, mockConvId, new GetMessagesQueryDto());
      expect(msgs).toHaveLength(1);
      expect(db.cpMessage.findMany).toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    it('throws NotFoundException if conversation not found in workspace', async () => {
      db.cpConversation.findFirst.mockResolvedValue(null);
      await expect(service.sendMessage(mockCtx, mockConvId, { content: 'test' } as SendMessageDto)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if user is not a participant', async () => {
      db.cpConversation.findFirst.mockResolvedValue({ id: mockConvId, workspaceId: 'ws-1' });
      db.cpConversationParticipant.findUnique.mockResolvedValue(null);
      await expect(service.sendMessage(mockCtx, mockConvId, { content: 'test' } as SendMessageDto)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException if user has left the conversation', async () => {
      db.cpConversation.findFirst.mockResolvedValue({ id: mockConvId, workspaceId: 'ws-1' });
      db.cpConversationParticipant.findUnique.mockResolvedValue({ leftAt: new Date() });
      await expect(service.sendMessage(mockCtx, mockConvId, { content: 'test' } as SendMessageDto)).rejects.toThrow(ForbiddenException);
    });

    it('creates message and emits if user is an active participant', async () => {
      db.cpConversation.findFirst.mockResolvedValue({ id: mockConvId, workspaceId: 'ws-1', participants: [] });
      db.cpConversationParticipant.findUnique.mockResolvedValue({ leftAt: null });
      db.cpWorkspaceMember.findUnique.mockResolvedValue({ role: 'STAFF', staffProfile: { name: 'Test' } });
      db.cpMessage.create.mockResolvedValue({ id: 'msg-1', content: 'test' });
      db.cpConversation.update.mockResolvedValue({});

      const msg = await service.sendMessage(mockCtx, mockConvId, { content: 'test' } as SendMessageDto);
      expect(msg.id).toBe('msg-1');
      expect(db.cpMessage.create).toHaveBeenCalled();
      expect(gateway.server.to).toHaveBeenCalledWith(`conversation:${mockConvId}`);
    });
  });

  describe('markRead', () => {
    it('throws NotFoundException if conversation not found in workspace', async () => {
      db.cpConversation.findFirst.mockResolvedValue(null);
      await expect(service.markRead(mockCtx, mockConvId)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if user is not a participant', async () => {
      db.cpConversation.findFirst.mockResolvedValue({ id: mockConvId, workspaceId: 'ws-1' });
      db.cpConversationParticipant.findUnique.mockResolvedValue(null);
      await expect(service.markRead(mockCtx, mockConvId)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException if user has left the conversation', async () => {
      db.cpConversation.findFirst.mockResolvedValue({ id: mockConvId, workspaceId: 'ws-1' });
      db.cpConversationParticipant.findUnique.mockResolvedValue({ leftAt: new Date() });
      await expect(service.markRead(mockCtx, mockConvId)).rejects.toThrow(ForbiddenException);
    });

    it('updates participant if user is an active participant', async () => {
      db.cpConversation.findFirst.mockResolvedValue({ id: mockConvId, workspaceId: 'ws-1' });
      db.cpConversationParticipant.findUnique.mockResolvedValue({ id: 'part-1', leftAt: null });
      db.cpConversationParticipant.update.mockResolvedValue({});

      await expect(service.markRead(mockCtx, mockConvId)).resolves.toEqual({ ok: true });
      expect(db.cpConversationParticipant.update).toHaveBeenCalled();
    });
  });
});
