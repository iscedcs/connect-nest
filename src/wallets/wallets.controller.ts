import { Controller, Get, Post, Patch, Body, Request, ValidationPipe, Param, Query } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { CreateWalletDto, UpdateWalletDto, BulkVisibilityDto, BulkDeleteDto, BulkRestoreDto, WalletResponseDto } from './dto/wallet.dto';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags, ApiParam, ApiQuery } from '@nestjs/swagger';

@ApiTags('Wallets')
@ApiBearerAuth('access-token')
@Controller('profiles/:profileId/wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Post('add')
  @ApiOperation({ summary: 'Add a wallet to a profile' })
  @ApiResponse({ status: 201, description: 'Wallet created successfully', type: WalletResponseDto })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: CreateWalletDto })
  createWallet(@Request() req, @Param('profileId') profileId: string, @Body(ValidationPipe) dto: CreateWalletDto) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.walletsService.createWallet(user, profileId, dto);
  }

  @Get('all')
  @ApiOperation({ summary: 'List all wallets for a profile' })
  @ApiResponse({ status: 200, description: 'Wallets retrieved successfully', type: [WalletResponseDto] })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'per_page', required: false })
  @ApiQuery({ name: 'include_deleted', required: false })
  @ApiQuery({ name: 'sort', required: false })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  getAllWallets(@Request() req, @Param('profileId') profileId: string, @Query('page') page: number = 1, @Query('per_page') perPage: number = 25, @Query('include_deleted') includeDeleted: boolean = false, @Query('sort') sort?: string, @Query('order') order: 'asc' | 'desc' = 'asc') {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.walletsService.getAllWallets(user, profileId, page, perPage, includeDeleted, sort, order);
  }

  @Get('one/:id')
  @ApiOperation({ summary: 'Get a specific wallet by ID' })
  @ApiResponse({ status: 200, description: 'Wallet retrieved successfully', type: WalletResponseDto })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Wallet ID' })
  getWalletById(@Request() req, @Param('profileId') profileId: string, @Param('id') id: string) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.walletsService.getWalletById(user, profileId, id);
  }

  @Patch('update/:id')
  @ApiOperation({ summary: 'Update a specific wallet' })
  @ApiResponse({ status: 200, description: 'Wallet updated successfully', type: WalletResponseDto })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Wallet ID' })
  @ApiBody({ type: UpdateWalletDto })
  updateWallet(@Request() req, @Param('profileId') profileId: string, @Param('id') id: string, @Body(ValidationPipe) dto: UpdateWalletDto) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.walletsService.updateWallet(user, profileId, id, dto);
  }

  @Patch('delete/:id')
  @ApiOperation({ summary: 'Soft delete a specific wallet' })
  @ApiResponse({ status: 204, description: 'Wallet deleted successfully' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Wallet ID' })
  deleteWallet(@Request() req, @Param('profileId') profileId: string, @Param('id') id: string) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.walletsService.deleteWallet(user, profileId, id);
  }

  @Patch('restore/:id')
  @ApiOperation({ summary: 'Restore a soft-deleted wallet' })
  @ApiResponse({ status: 200, description: 'Wallet restored successfully', type: WalletResponseDto })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Wallet ID' })
  restoreWallet(@Request() req, @Param('profileId') profileId: string, @Param('id') id: string) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.walletsService.restoreWallet(user, profileId, id);
  }

  @Patch('visibility/:id')
  @ApiOperation({ summary: 'Toggle visibility of a wallet' })
  @ApiResponse({ status: 200, description: 'Wallet visibility updated successfully', type: WalletResponseDto })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Wallet ID' })
  @ApiBody({ schema: { type: 'object', properties: { is_visible: { type: 'boolean' } } } })
  toggleVisibility(@Request() req, @Param('profileId') profileId: string, @Param('id') id: string, @Body('is_visible') isVisible: boolean) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.walletsService.toggleVisibility(user, profileId, id, isVisible);
  }

  @Patch('default/:id')
  @ApiOperation({ summary: 'Set a wallet as default' })
  @ApiResponse({ status: 200, description: 'Default wallet set successfully', type: WalletResponseDto })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'id', description: 'Wallet ID' })
  setDefaultWallet(@Request() req, @Param('profileId') profileId: string, @Param('id') id: string) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.walletsService.setDefaultWallet(user, profileId, id);
  }

  @Get('default')
  @ApiOperation({ summary: 'Get the default wallet for a profile' })
  @ApiResponse({ status: 200, description: 'Default wallet retrieved successfully', type: WalletResponseDto })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  getDefaultWallet(@Request() req, @Param('profileId') profileId: string) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.walletsService.getDefaultWallet(user, profileId);
  }

  @Get('network/:network')
  @ApiOperation({ summary: 'Get wallets by network for a profile' })
  @ApiResponse({ status: 200, description: 'Wallets retrieved successfully', type: [WalletResponseDto] })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiParam({ name: 'network', description: 'Network name (e.g., eth, btc)' })
  getWalletsByNetwork(@Request() req, @Param('profileId') profileId: string, @Param('network') network: string) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.walletsService.getWalletsByNetwork(user, profileId, network);
  }

  @Patch('all/delete')
  @ApiOperation({ summary: 'Bulk delete wallets' })
  @ApiResponse({ status: 204, description: 'Wallets deleted successfully' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: BulkDeleteDto })
  bulkDelete(@Request() req, @Param('profileId') profileId: string, @Body(ValidationPipe) dto: BulkDeleteDto) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.walletsService.bulkDelete(user, profileId, dto);
  }

  @Patch('all/restore')
  @ApiOperation({ summary: 'Bulk restore wallets' })
  @ApiResponse({ status: 200, description: 'Wallets restored successfully' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: BulkRestoreDto })
  bulkRestore(@Request() req, @Param('profileId') profileId: string, @Body(ValidationPipe) dto: BulkRestoreDto) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.walletsService.bulkRestore(user, profileId, dto);
  }

  @Patch('visibility/all')
  @ApiOperation({ summary: 'Bulk update visibility of wallets' })
  @ApiResponse({ status: 204, description: 'Wallets visibility updated successfully' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({ type: BulkVisibilityDto })
  bulkVisibility(@Request() req, @Param('profileId') profileId: string, @Body(ValidationPipe) dto: BulkVisibilityDto) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.walletsService.bulkVisibility(user, profileId, dto);
  }
}

