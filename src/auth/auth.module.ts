import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtService } from './jwt.service';
import { JwtStrategy } from './jwt.strategy';
import { AuthClientService } from './auth-client.service';
import { jwtSecret } from 'utils/constants';

@Module({
  imports: [
    JwtModule.register({
      secret: jwtSecret,
      signOptions: { expiresIn: '24h' },
    }),
    PassportModule,
  ],
  controllers: [],
  providers: [JwtService, JwtStrategy, AuthClientService],
  exports: [JwtService, AuthClientService],
})
export class AuthModule {}
