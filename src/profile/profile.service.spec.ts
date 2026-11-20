import { Test, TestingModule } from '@nestjs/testing';
import { ProfileService } from './profile.service';
import { DatabaseService } from '../database/database.service';
import { AuthClientService } from '../auth/auth-client.service';
import { WalletClientService } from '../auth/wallet-client.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PlanTier } from '../generated/prisma/client';

describe('ProfileService.ensureDefaultProfile', () => {
  let service: ProfileService;
  let txMock: {
    $executeRaw: jest.Mock;
    profile: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
    };
  };
  let dbMock: { $transaction: jest.Mock };
  let subscriptionsMock: { createSubscription: jest.Mock };

  beforeEach(async () => {
    txMock = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      profile: {
        findFirst: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
    };

    dbMock = {
      $transaction: jest.fn((cb) => cb(txMock)),
    };

    subscriptionsMock = {
      createSubscription: jest.fn().mockResolvedValue({ id: 'sub_1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: DatabaseService, useValue: dbMock },
        { provide: AuthClientService, useValue: {} },
        { provide: WalletClientService, useValue: {} },
        { provide: SubscriptionsService, useValue: subscriptionsMock },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
  });

  it('creates a default profile with unique slug and FREE subscription when user has none', async () => {
    txMock.profile.findFirst.mockResolvedValue(null);
    txMock.profile.findUnique
      .mockResolvedValueOnce({ id: 'other' }) // 'john-doe' taken
      .mockResolvedValueOnce(null); // 'john-doe-1' free
    const createdProfile = {
      id: 'prof_1',
      userId: 'user_1',
      name: 'John Doe',
      slug: 'john-doe-1',
      is_default: true,
    };
    txMock.profile.create.mockResolvedValue(createdProfile);

    const res = await service.ensureDefaultProfile('user_1', {
      name: 'John Doe',
      profilePhoto: 'https://example.com/a.jpg',
    });

    expect(res).toEqual({
      success: true,
      created: true,
      message: 'Default profile created successfully',
      data: { profile: createdProfile },
    });
    expect(txMock.$executeRaw).toHaveBeenCalledTimes(1);
    expect(txMock.profile.create).toHaveBeenCalledWith({
      data: {
        userId: 'user_1',
        name: 'John Doe',
        profilePhoto: 'https://example.com/a.jpg',
        slug: 'john-doe-1',
        is_default: true,
      },
    });
    expect(subscriptionsMock.createSubscription).toHaveBeenCalledWith(
      'user_1',
      PlanTier.FREE,
      true,
    );
  });

  it('returns existing profile unchanged without creating a second profile or subscription', async () => {
    const existingProfile = {
      id: 'prof_existing',
      userId: 'user_1',
      name: 'Jane Doe',
      slug: 'jane-doe',
      is_default: true,
    };
    txMock.profile.findFirst.mockResolvedValue(existingProfile);

    const res = await service.ensureDefaultProfile('user_1', {
      name: 'New Name',
    });

    expect(res).toEqual({
      success: true,
      created: false,
      message: 'Default profile already exists',
      data: { profile: existingProfile },
    });
    expect(txMock.profile.create).not.toHaveBeenCalled();
    expect(subscriptionsMock.createSubscription).not.toHaveBeenCalled();
  });
});
