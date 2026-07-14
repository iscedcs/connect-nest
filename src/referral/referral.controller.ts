import { Controller, Get, Post, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthClientService } from '../auth/auth-client.service';

@ApiTags('Referral')
@ApiBearerAuth('access-token')
@Controller('referral')
export class ReferralController {
  constructor(private readonly authClientService: AuthClientService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get referral summary for current user' })
  getReferralSummary(@Request() req) {
    const authHeader = req.headers.authorization;
    return this.authClientService.getReferralSummary(authHeader);
  }

  @Post('business/apply')
  @ApiOperation({ summary: 'Apply for business referrer status' })
  applyForBusinessReferrer(@Request() req) {
    const authHeader = req.headers.authorization;
    return this.authClientService.applyForBusinessReferrer(authHeader);
  }

  @Post('cash-out')
  @ApiOperation({ summary: 'Request cash out for referral earnings' })
  requestCashOut(@Request() req) {
    const authHeader = req.headers.authorization;
    return this.authClientService.requestCashOut(authHeader);
  }
}
