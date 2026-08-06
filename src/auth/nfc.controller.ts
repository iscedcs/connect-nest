import { Controller, Get, Query, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { WalletClientService } from './wallet-client.service';

@ApiTags('NFC')
@ApiBearerAuth('access-token')
@Controller('nfc')
export class NfcController {
  constructor(private readonly walletClient: WalletClientService) {}

  @Get('resolve')
  @ApiOperation({
    summary: 'Resolve an NFC productId to user + wallet info',
    description:
      'Proxies wallet-nest to identify who owns a tapped NFC card/wristband/sticker and their wallet status.',
  })
  @ApiQuery({ name: 'productId', description: 'The NFC tag productId from the URL' })
  @ApiResponse({ status: 200, description: 'Device resolved' })
  async resolve(@Request() req, @Query('productId') productId: string) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.walletClient.resolveNfc(productId, req.headers.authorization);
  }
}
