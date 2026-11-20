import { Test, TestingModule } from '@nestjs/testing';
import { InternalService } from './internal.service';
import { DatabaseService } from '../database/database.service';
import { CpOrganizationsService } from '../connect-plus/organizations/organizations.service';
import { CpWorkspacesService } from '../connect-plus/workspaces/workspaces.service';
import { ProfileService } from '../profile/profile.service';

describe('InternalService.ensureDefaultProfile', () => {
  let service: InternalService;
  let profileServiceMock: { ensureDefaultProfile: jest.Mock };

  beforeEach(async () => {
    profileServiceMock = {
      ensureDefaultProfile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InternalService,
        { provide: DatabaseService, useValue: {} },
        { provide: CpOrganizationsService, useValue: {} },
        { provide: CpWorkspacesService, useValue: {} },
        { provide: ProfileService, useValue: profileServiceMock },
      ],
    }).compile();

    service = module.get<InternalService>(InternalService);
  });

  it('delegates to ProfileService.ensureDefaultProfile', async () => {
    const expected = { success: true, created: true, data: { profile: {} } };
    profileServiceMock.ensureDefaultProfile.mockResolvedValue(expected);

    const res = await service.ensureDefaultProfile(
      'auth_123',
      'Ada Lovelace',
      'https://example.com/ada.png',
    );

    expect(profileServiceMock.ensureDefaultProfile).toHaveBeenCalledWith(
      'auth_123',
      { name: 'Ada Lovelace', profilePhoto: 'https://example.com/ada.png' },
    );
    expect(res).toBe(expected);
  });
});
