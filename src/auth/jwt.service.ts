import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { jwtSecret } from 'utils/constants';

@Injectable()
export class JwtService {
  constructor(private readonly jwtService: NestJwtService) {}

  async validateToken(token: string): Promise<any> {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: jwtSecret,
      });
      return payload;
    } catch (error) {
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
    } catch (error) {
      return null;
    }
  }
}
