import { Controller, Get, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WalletClientService } from './wallet-client.service';

@ApiTags('Wallet')
@ApiBearerAuth('access-token')
@Controller('wallet')
export class WalletStatusController {
  constructor(private readonly walletClient: WalletClientService) {}

  @Get('kyc-status')
  @ApiOperation({
    summary: "Get the current user's wallet KYC status",
    description:
      'Proxies wallet-nest to report whether the caller has a KYC-verified wallet and can receive wallet payments.',
  })
  @ApiResponse({ status: 200, description: 'KYC status retrieved' })
  async getKycStatus(@Request() req) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    const info = await this.walletClient.getUserWalletKycInfo(
      user.id,
      req.headers.authorization,
    );
    return { success: true, data: info };
  }
}
