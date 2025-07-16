import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';
import { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    let token = request.headers.authorization;

    if (!token) {
      throw new UnauthorizedException('Authorization header is missing');
    }

    // Remove "Bearer " prefix if present
    if (token.startsWith('Bearer ')) {
      token = token.slice(7); // Remove the "Bearer " part
    }

    console.log('TOKEN', token);

    try {
      // Decode the JWT token to extract payload
      const decoded = jwt.decode(token) as {
        fullname?: string;
        id?: string;
        email?: string;
        password?: string;
      };

      const { email, password } = decoded || {};

      console.log('DECODED', decoded);

      if (!email || !password) {
        throw new UnauthorizedException('Invalid token payload');
      }

      // Make a request to the authentication API to validate the token
      const authResponse = await axios.post(
        `${process.env.AUTH_URL}/auth/signin-events`,
        { email, password },
        { headers: { Authorization: `Bearer ${token}` } }, // Ensure Bearer prefix when sending the token
      );

      if (authResponse.data.success) {
        // Attach user info to the request for later use
        const user = jwt.decode(authResponse.data.token);
        console.log('USER', user);
        (request as any).isce_auth = user;
        console.log('ISCEAUTH', (request as any).isce_auth);
        return true;
      } else {
        throw new UnauthorizedException('Unauthorized');
      }
    } catch (error) {
      console.error('Authentication error:', error.message || error);
      throw new UnauthorizedException('Unauthorized');
    }
  }
}
