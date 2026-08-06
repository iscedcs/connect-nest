import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Request,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { ThreadService } from './thread.service';
import {
  CreateThreadDto,
  SendMessageDto,
  SendProposalDto,
  AcceptProposalDto,
  DeclineProposalDto,
  ConfirmPaymentDto,
  ExecuteWalletPaymentDto,
  DisputePaymentDto,
  ThreadQueryDto,
} from './dto/artisan.dto';

// ═══════════════════════════════════════════════════════════
// Thread Controller — booking conversation & payment
// ═══════════════════════════════════════════════════════════

@ApiTags('Booking Threads')
@ApiBearerAuth('access-token')
@Controller('threads')
export class ThreadController {
  constructor(private readonly threadService: ThreadService) {}

  // ─── Thread CRUD ──────────────────────────────────────

  @Post()
  @ApiOperation({
    summary: 'Start a new inquiry thread with an artisan',
  })
  @ApiResponse({ status: 201, description: 'Thread created' })
  async createThread(
    @Request() req,
    @Body(ValidationPipe) dto: CreateThreadDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.threadService.createThread(user.id, dto);
  }

  @Get('my-threads')
  @ApiOperation({
    summary: 'List threads where I am the client',
  })
  @ApiResponse({ status: 200, description: 'Client threads returned' })
  async getMyThreads(
    @Request() req,
    @Query(ValidationPipe) query: ThreadQueryDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.threadService.getThreads(user.id, 'client', undefined, query);
  }

  @Get('artisan/:profileId')
  @ApiOperation({
    summary: 'List threads for my artisan profile (artisan side)',
  })
  @ApiResponse({ status: 200, description: 'Artisan threads returned' })
  async getArtisanThreads(
    @Request() req,
    @Param('profileId') profileId: string,
    @Query(ValidationPipe) query: ThreadQueryDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.threadService.getThreads(user.id, 'artisan', profileId, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread message count across all threads' })
  @ApiResponse({ status: 200, description: 'Unread count returned' })
  async getUnreadCount(@Request() req) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.threadService.getUnreadCount(user.id);
  }

  @Get(':threadId')
  @ApiOperation({
    summary: 'Get a thread with all messages',
  })
  @ApiResponse({ status: 200, description: 'Thread returned' })
  @ApiResponse({ status: 404, description: 'Thread not found' })
  async getThread(@Request() req, @Param('threadId') threadId: string) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.threadService.getThread(threadId, user.id);
  }

  // ─── Messaging ────────────────────────────────────────

  @Post(':threadId/messages')
  @ApiOperation({ summary: 'Send a text message in a thread' })
  @ApiResponse({ status: 201, description: 'Message sent' })
  async sendMessage(
    @Request() req,
    @Param('threadId') threadId: string,
    @Body(ValidationPipe) dto: SendMessageDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.threadService.sendMessage(threadId, user.id, dto);
  }

  @Post(':threadId/proposals')
  @ApiOperation({
    summary: 'Send a structured proposal (artisan only)',
  })
  @ApiResponse({ status: 201, description: 'Proposal sent' })
  @ApiQuery({
    name: 'profileId',
    required: true,
    description: 'Artisan profile ID',
  })
  async sendProposal(
    @Request() req,
    @Param('threadId') threadId: string,
    @Query('profileId') profileId: string,
    @Body(ValidationPipe) dto: SendProposalDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.threadService.sendProposal(threadId, user.id, profileId, dto);
  }

  @Post(':threadId/proposals/accept')
  @ApiOperation({
    summary: 'Accept a proposal (client only) — creates booking',
  })
  @ApiResponse({
    status: 201,
    description: 'Proposal accepted, booking created',
  })
  async acceptProposal(
    @Request() req,
    @Param('threadId') threadId: string,
    @Body(ValidationPipe) dto: AcceptProposalDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.threadService.acceptProposal(
      threadId,
      user.id,
      dto,
      req.headers.authorization,
    );
  }

  @Post(':threadId/proposals/decline')
  @ApiOperation({
    summary: 'Decline a proposal (client only)',
  })
  @ApiResponse({ status: 200, description: 'Proposal declined' })
  async declineProposal(
    @Request() req,
    @Param('threadId') threadId: string,
    @Body(ValidationPipe) dto: DeclineProposalDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.threadService.declineProposal(threadId, user.id, dto);
  }

  @Post(':threadId/close')
  @ApiOperation({
    summary: 'Close a thread (either party)',
  })
  @ApiResponse({ status: 200, description: 'Thread closed' })
  async closeThread(@Request() req, @Param('threadId') threadId: string) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.threadService.closeThread(threadId, user.id);
  }

  // ─── Payment Confirmation ─────────────────────────────

  @Post('bookings/:bookingId/confirm-payment-sent')
  @ApiOperation({
    summary: 'Client confirms they sent payment (offline)',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment sent confirmation recorded',
  })
  async confirmPaymentSent(
    @Request() req,
    @Param('bookingId') bookingId: string,
    @Body(ValidationPipe) dto: ConfirmPaymentDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.threadService.confirmPaymentSent(bookingId, user.id, dto);
  }

  @Post('bookings/:bookingId/confirm-payment-received')
  @ApiOperation({
    summary: 'Artisan confirms they received payment (offline)',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment received confirmation recorded',
  })
  @ApiQuery({
    name: 'profileId',
    required: true,
    description: 'Artisan profile ID',
  })
  async confirmPaymentReceived(
    @Request() req,
    @Param('bookingId') bookingId: string,
    @Query('profileId') profileId: string,
    @Body(ValidationPipe) dto: ConfirmPaymentDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.threadService.confirmPaymentReceived(
      bookingId,
      user.id,
      profileId,
      dto,
    );
  }

  @Post('bookings/:bookingId/dispute-payment')
  @ApiOperation({
    summary: 'Dispute a payment (either party)',
  })
  @ApiResponse({ status: 200, description: 'Payment dispute raised' })
  async disputePayment(
    @Request() req,
    @Param('bookingId') bookingId: string,
    @Body(ValidationPipe) dto: DisputePaymentDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.threadService.disputePayment(bookingId, user.id, dto);
  }

  @Post('bookings/:bookingId/wallet-payment/execute')
  @ApiOperation({
    summary: 'Execute the wallet payment for a booking (customer, PIN-confirmed)',
  })
  @ApiResponse({ status: 200, description: 'Payment executed (or requires fraud confirmation)' })
  async executeWalletPayment(
    @Request() req,
    @Param('bookingId') bookingId: string,
    @Body(ValidationPipe) dto: ExecuteWalletPaymentDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.threadService.executeWalletPayment(
      bookingId,
      user.id,
      dto,
      req.headers.authorization,
    );
  }

  @Post('bookings/:bookingId/wallet-payment/cancel')
  @ApiOperation({ summary: 'Cancel the wallet payment intent for a booking' })
  @ApiResponse({ status: 200, description: 'Payment intent cancelled' })
  async cancelWalletPayment(
    @Request() req,
    @Param('bookingId') bookingId: string,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.threadService.cancelWalletPayment(
      bookingId,
      user.id,
      req.headers.authorization,
    );
  }

  @Get('bookings/:bookingId/wallet-payment')
  @ApiOperation({ summary: 'Get the wallet payment intent status for a booking' })
  @ApiResponse({ status: 200, description: 'Payment intent status (or null if none yet)' })
  async getWalletPaymentStatus(
    @Request() req,
    @Param('bookingId') bookingId: string,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.threadService.getWalletPaymentStatus(
      bookingId,
      user.id,
      req.headers.authorization,
    );
  }
}
