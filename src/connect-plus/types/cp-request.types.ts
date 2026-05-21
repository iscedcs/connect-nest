import { CpRole } from '../../generated/prisma/client';
import { Request } from 'express';

export interface IsceAuthPayload {
  id: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  displayPicture?: string;
  userType?: string;
}

export interface CpRequestContext {
  authUserId: string;
  workspaceId?: string;
  organizationId: string;
  role: CpRole;
  memberId?: string;
}

export interface CpRequest extends Request {
  isce_auth: IsceAuthPayload;
  cp: CpRequestContext;
}
