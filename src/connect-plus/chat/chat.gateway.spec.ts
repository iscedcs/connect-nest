import { Test, TestingModule } from '@nestjs/testing';
import { CpChatGateway } from './chat.gateway';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../../database/database.service';
import { CpMemberStatus } from '../../generated/prisma/client';

describe('CpChatGateway', () => {
  let gateway: CpChatGateway;
  let jwtService: any;
  let db: any;

  beforeEach(async () => {
    jwtService = {
      verify: jest.fn(),
    };

    db = {
      cpWorkspaceMember: {
        findUnique: jest.fn(),
      },
      cpConversationParticipant: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CpChatGateway,
        { provide: JwtService, useValue: jwtService },
        { provide: DatabaseService, useValue: db },
      ],
    }).compile();

    gateway = module.get<CpChatGateway>(CpChatGateway);
  });

  describe('handleConnection', () => {
    it('disconnects client if token is missing', () => {
      const client = { handshake: { auth: {} }, emit: jest.fn(), disconnect: jest.fn() } as any;
      gateway.handleConnection(client);
      expect(client.emit).toHaveBeenCalledWith('cp:error', { message: 'Unauthorized' });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('disconnects client if token is invalid', () => {
      const client = { handshake: { auth: { token: 'invalid' } }, emit: jest.fn(), disconnect: jest.fn() } as any;
      jwtService.verify.mockImplementation(() => { throw new Error(); });
      gateway.handleConnection(client);
      expect(client.emit).toHaveBeenCalledWith('cp:error', { message: 'Unauthorized' });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('authenticates client with valid token', () => {
      const client = { id: 'socket-1', data: {}, handshake: { auth: { token: 'valid' } }, emit: jest.fn(), disconnect: jest.fn() } as any;
      jwtService.verify.mockReturnValue({ id: 'user-1' });
      gateway.handleConnection(client);
      expect(client.data.authUserId).toBe('user-1');
      expect(client.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('handleJoinWorkspace', () => {
    it('emits error if user is not authenticated', async () => {
      const client = { data: {}, emit: jest.fn() } as any;
      await gateway.handleJoinWorkspace(client, { workspaceId: 'ws-1' });
      expect(client.emit).toHaveBeenCalledWith('cp:error', { message: 'Unauthorized' });
    });

    it('emits error if user is not a member of the workspace', async () => {
      const client = { data: { authUserId: 'user-1' }, emit: jest.fn() } as any;
      db.cpWorkspaceMember.findUnique.mockResolvedValue(null);
      await gateway.handleJoinWorkspace(client, { workspaceId: 'ws-1' });
      expect(client.emit).toHaveBeenCalledWith('cp:error', { message: 'Not a member of this workspace' });
    });

    it('emits error if user is not an active member of the workspace', async () => {
      const client = { data: { authUserId: 'user-1' }, emit: jest.fn() } as any;
      db.cpWorkspaceMember.findUnique.mockResolvedValue({ status: CpMemberStatus.SUSPENDED });
      await gateway.handleJoinWorkspace(client, { workspaceId: 'ws-1' });
      expect(client.emit).toHaveBeenCalledWith('cp:error', { message: 'Not a member of this workspace' });
    });

    it('joins workspace and all active conversation rooms', async () => {
      const client = { data: { authUserId: 'user-1' }, emit: jest.fn(), join: jest.fn() } as any;
      db.cpWorkspaceMember.findUnique.mockResolvedValue({ status: CpMemberStatus.ACTIVE, workspace: { name: 'Test', slug: 'test' } });
      db.cpConversationParticipant.findMany.mockResolvedValue([{ conversationId: 'conv-1' }, { conversationId: 'conv-2' }]);

      await gateway.handleJoinWorkspace(client, { workspaceId: 'ws-1' });
      expect(client.join).toHaveBeenCalledWith('workspace:ws-1');
      expect(client.join).toHaveBeenCalledWith('conversation:conv-1');
      expect(client.join).toHaveBeenCalledWith('conversation:conv-2');
      expect(client.emit).toHaveBeenCalledWith('cp:workspace-joined', { workspaceId: 'ws-1', name: 'Test', slug: 'test' });
    });
  });
});
