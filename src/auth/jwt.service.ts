import { Injectable, UnauthorizedException } from '@nestjs/common';
import { verifyAccessToken } from './token-verifier';

@Injectable()
export class JwtService {
  async validateToken(token: string): Promise<any> {
    try {
      const { payload } = await verifyAccessToken(token);
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async extractUserFromToken(token: string): Promise<{
    id: string;
    email: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    displayPicture?: string;
    userType?: string;
  } | null> {
    try {
      const payload = await this.validateToken(token);
      return {
        id: payload.id,
        email: payload.email,
        phone: payload.phone,
        firstName: payload.firstName,
        lastName: payload.lastName,
        displayPicture: payload.displayPicture,
        userType: payload.userType,
      };
    } catch {
      return null;
    }
  }
}
