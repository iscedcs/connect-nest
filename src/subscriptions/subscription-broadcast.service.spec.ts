import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionBroadcastService } from './subscription-broadcast.service';
import { DatabaseService } from '../database/database.service';
import { NotificationDispatcher } from '../notification/notification-dispatcher.service';
import { EmailService } from '../notification/email.service';
import { AuthClientService } from '../auth/auth-client.service';
import { SubscriptionsService } from './subscriptions.service';
import { NotificationType, PlanTier, SubscriptionStatus } from '../generated/prisma/client';

describe('SubscriptionBroadcastService', () => {
  let service: SubscriptionBroadcastService;
  let db: any;
  let notifications: any;
  let emailService: any;
  let authClient: any;
  let subscriptionsService: any;

  beforeEach(async () => {
    db = {
      profile: {
        findMany: jest.fn(),
      },
      subscription: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    notifications = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    emailService = {
      sendSubscriptionLaunchEmail: jest.fn().mockResolvedValue(true),
    };

    authClient = {
      getUserEmail: jest.fn().mockResolvedValue('user@example.com'),
    };

    subscriptionsService = {
      createSubscription: jest.fn().mockResolvedValue({
        id: 'sub-new',
        userId: 'usr-1',
        status: SubscriptionStatus.ACTIVE,
        notifiedLaunch: false,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionBroadcastService,
        { provide: DatabaseService, useValue: db },
        { provide: NotificationDispatcher, useValue: notifications },
        { provide: EmailService, useValue: emailService },
        { provide: AuthClientService, useValue: authClient },
        { provide: SubscriptionsService, useValue: subscriptionsService },
      ],
    }).compile();

    service = module.get<SubscriptionBroadcastService>(
      SubscriptionBroadcastService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('testEmail mode', () => {
    it('should dispatch a single test email without querying all profiles', async () => {
      const result = await service.broadcastLaunchAnnouncement({
        testEmail: 'admin@lyncon.app',
      });

      expect(emailService.sendSubscriptionLaunchEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@lyncon.app',
          recipientName: 'Test Member',
          trialMonths: 6,
        }),
      );
      expect(result.testEmailSent).toBe(true);
      expect(result.emailsSent).toBe(1);
      expect(db.profile.findMany).not.toHaveBeenCalled();
    });
  });

  describe('dryRun mode', () => {
    it('should simulate broadcast without sending real notifications or updating DB', async () => {
      db.profile.findMany.mockResolvedValue([
        { id: 'prof-1', userId: 'usr-1', name: 'Alice' },
        { id: 'prof-2', userId: 'usr-2', name: 'Bob' },
      ]);
      db.subscription.findUnique.mockResolvedValue(null);

      const result = await service.broadcastLaunchAnnouncement({
        dryRun: true,
      });

      expect(result.dryRun).toBe(true);
      expect(result.totalCandidates).toBe(2);
      expect(result.emailsSent).toBe(2);
      expect(result.inAppSent).toBe(2);
      expect(notifications.dispatch).not.toHaveBeenCalled();
      expect(emailService.sendSubscriptionLaunchEmail).not.toHaveBeenCalled();
      expect(db.subscription.update).not.toHaveBeenCalled();
    });
  });

  describe('live broadcast', () => {
    it('should auto-create subscription, dispatch in-app notification, send email, and mark as notified', async () => {
      db.profile.findMany.mockResolvedValue([
        { id: 'prof-1', userId: 'usr-1', name: 'Alice' },
      ]);
      db.subscription.findUnique.mockResolvedValue(null);
      db.subscription.update.mockResolvedValue({ id: 'sub-new', notifiedLaunch: true });

      const result = await service.broadcastLaunchAnnouncement({
        dryRun: false,
      });

      expect(subscriptionsService.createSubscription).toHaveBeenCalledWith(
        'usr-1',
        PlanTier.FREE,
        true,
      );
      expect(notifications.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'usr-1',
          profileId: 'prof-1',
          type: NotificationType.SUBSCRIPTION_LAUNCH_ANNOUNCEMENT,
        }),
      );
      expect(authClient.getUserEmail).toHaveBeenCalledWith('usr-1');
      expect(emailService.sendSubscriptionLaunchEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          recipientName: 'Alice',
          trialMonths: 6,
        }),
      );
      expect(db.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-new' },
        data: { notifiedLaunch: true },
      });
      expect(result.processed).toBe(1);
      expect(result.emailsSent).toBe(1);
      expect(result.inAppSent).toBe(1);
    });

    it('should skip users who have already been notified', async () => {
      db.profile.findMany.mockResolvedValue([
        { id: 'prof-1', userId: 'usr-1', name: 'Alice' },
      ]);
      db.subscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        userId: 'usr-1',
        notifiedLaunch: true,
      });

      const result = await service.broadcastLaunchAnnouncement({
        dryRun: false,
      });

      expect(notifications.dispatch).not.toHaveBeenCalled();
      expect(emailService.sendSubscriptionLaunchEmail).not.toHaveBeenCalled();
      expect(result.processed).toBe(1);
      expect(result.emailsSent).toBe(0);
      expect(result.inAppSent).toBe(0);
    });
  });
});
