import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthClientService } from '../auth/auth-client.service';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { AttachReferralDto } from './dto/attach-referral.dto';
import { AdminPatchReferrerDto } from './dto/admin-patch-referrer.dto';

@ApiTags('Referral')
@ApiBearerAuth('access-token')
@Controller('referral')
export class ReferralController {
  constructor(private readonly authClientService: AuthClientService) {}

  // ─── User-facing ──────────────────────────────────────────────────────────

  @Get('me')
  @ApiOperation({ summary: 'Get referral summary for current user' })
  getReferralSummary(@Request() req) {
    const authHeader = req.headers.authorization;
    return this.authClientService.getReferralSummary(authHeader);
  }

  @Get('referred')
  @ApiOperation({
    summary: 'List the people the current user referred, newest first',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  listReferredUsers(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const authHeader = req.headers.authorization;
    return this.authClientService.listReferredUsers(
      authHeader,
      Number(page) || 1,
      Number(limit) || 20,
    );
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

  /**
   * Bind the authenticated user to a referrer.
   *
   * Called server-side from connect-web's auth/callback after token exchange.
   * The INTERNAL_API_KEY is injected here — it never reaches the browser.
   * Safe to call on every sign-in: isce-auth silently no-ops when
   * referredById is already set, the code is unknown, or it's a self-referral.
   */
  @Post('attach')
  @ApiOperation({
    summary: 'Attach the current user to a referrer (G1)',
    description:
      'Server-side bridge that forwards to the isce-auth internal endpoint using the INTERNAL_API_KEY. ' +
      'Call this from your server action / route handler after the OAuth token exchange — never from the browser.',
  })
  @ApiBody({ type: AttachReferralDto })
  attachReferral(@Request() req, @Body() body: AttachReferralDto) {
    const userId: string = req.isce_auth.id;
    return this.authClientService.attachReferral(userId, body.referralUsername);
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  @Patch('admin/business/:userId')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({
    summary: 'Approve or reject a business referrer application (Admin)',
  })
  @ApiParam({ name: 'userId', description: 'isce-auth user ID of the applicant' })
  @ApiBody({ type: AdminPatchReferrerDto })
  adminPatchBusinessReferrer(
    @Param('userId') userId: string,
    @Body() body: AdminPatchReferrerDto,
    @Request() req,
  ) {
    const authHeader = req.headers.authorization;
    return this.authClientService.adminPatchBusinessReferrer(userId, body, authHeader);
  }

  @Get('admin/stats')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Get referral programme statistics (Admin)' })
  adminGetReferralStats(@Request() req) {
    const authHeader = req.headers.authorization;
    return this.authClientService.adminGetReferralStats(authHeader);
  }

  @Get('admin/default-account')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({
    summary: 'Get the Default Referral Account (house bucket) balance (Admin)',
  })
  adminGetDefaultAccount(@Request() req) {
    const authHeader = req.headers.authorization;
    return this.authClientService.adminGetDefaultAccount(authHeader);
  }
}

