import { SetMetadata } from '@nestjs/common';
import { CpRole } from '../../generated/prisma/client';

export const CP_ROLES_KEY = 'cpRoles';
export const CpRoles = (...roles: CpRole[]) =>
  SetMetadata(CP_ROLES_KEY, roles);
