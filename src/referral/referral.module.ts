import { Module } from '@nestjs/common';
import { ReferralController } from './referral.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ReferralController],
})
export class ReferralModule {}
