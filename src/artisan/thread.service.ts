import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Prisma } from '../generated/prisma/client';
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
import { ThreadEventService } from './thread-event.service';
import { NotificationDispatcher } from '../notification/notification-dispatcher.service';
import { AuthClientService } from '../auth/auth-client.service';
import { MailClientService } from '../mail/mail-client.service';
import { WalletClientService } from '../auth/wallet-client.service';

@Injectable()
export class ThreadService {
  constructor(
    private readonly db: DatabaseService,
    private readonly events: ThreadEventService,
    private readonly notifications: NotificationDispatcher,
    private readonly authClient: AuthClientService,
    private readonly mail: MailClientService,
    private readonly walletClient: WalletClientService,
  ) {}

  /**
   * Public wrapper around findAndValidateThread (used by SSE endpoint).
   */
  async validateParticipant(threadId: string, userId: string) {
    await this.findAndValidateThread(threadId, userId);
  }

  // ─── Thread CRUD ────────────────────────────────────────

  /**
   * Client creates a new inquiry thread with an artisan.
   */
  async createThread(userId: string, dto: CreateThreadDto) {
    // Verify artisan exists and is active
    const artisan = await this.db.artisan.findFirst({
      where: { id: dto.artisanId, status: 'ACTIVE' },
      include: {
        profile: {
          select: { id: true, name: true, profilePhoto: true, slug: true },
        },
      },
    });
    if (!artisan) {
      throw new NotFoundException('Artisan not found or not active');
    }

    // Prevent artisan from messaging themselves
    if (artisan.userId === userId) {
      throw new BadRequestException(
        'You cannot start a conversation with yourself',
      );
    }

    // Validate service if provided
    if (dto.serviceId) {
      const service = await this.db.artisanService.findFirst({
        where: { id: dto.serviceId, artisanId: dto.artisanId, isActive: true },
      });
      if (!service) {
        throw new NotFoundException('Service not found or not active');
      }
    }

    // Create thread + initial message in a transaction
    const thread = await this.db.$transaction(async (tx) => {
      const newThread = await tx.bookingThread.create({
        data: {
          artisanId: dto.artisanId,
          serviceId: dto.serviceId || null,
          clientUserId: userId,
          clientProfileId: dto.clientProfileId || null,
          clientName: dto.clientName || null,
          clientPhone: dto.clientPhone || null,
          status: 'OPEN',
        },
      });

      await tx.threadMessage.create({
        data: {
          threadId: newThread.id,
          senderUserId: userId,
          senderRole: 'CLIENT',
          type: 'TEXT',
          content: dto.message,
        },
      });

      return newThread;
    });

    // Return with full includes
    const fullThread = await this.getThreadById(thread.id, userId);

    // Notify artisan about new inquiry
    this.notifications
      .dispatchToThreadRecipient(
        thread.id,
        userId,
        'THREAD_NEW_INQUIRY',
        'New Booking Inquiry',
        dto.message?.slice(0, 100) || 'You have a new booking inquiry',
      )
      .catch(() => {});

    const webUrl = process.env.CONNECT_WEB_URL ?? '';
    this.emailThreadRecipient(
      thread.id,
      userId,
      'New Booking Inquiry',
      `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="margin-bottom:8px">New Booking Inquiry</h2>
  <p>You have received a new booking inquiry.</p>
  ${dto.message ? `<blockquote style="border-left:3px solid #ccc;margin:16px 0;padding:8px 16px;color:#555">${dto.message.slice(0, 200)}</blockquote>` : ''}
  <a href="${webUrl}/connect/artisan/threads/${thread.id}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:6px">View Thread</a>
</div>`,
    ).catch(() => {});

    return {
      success: true,
      message: 'Inquiry sent',
      data: fullThread,
    };
  }

  /**
   * Get threads for a user (either as client or as artisan).
   */
  async getThreads(
    userId: string,
    role: 'client' | 'artisan',
    profileId?: string,
    query?: ThreadQueryDto,
  ) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    let where: Prisma.BookingThreadWhereInput;

    if (role === 'artisan') {
      // Artisan must own the profile
      if (!profileId) {
        throw new BadRequestException('profileId is required for artisan');
      }
      const artisan = await this.findOwnArtisan(userId, profileId);
      where = { artisanId: artisan.id };
    } else {
      where = { clientUserId: userId };
    }

    if (query?.status) {
      where.status = query.status;
    }

    const [threads, total] = await Promise.all([
      this.db.bookingThread.findMany({
        where,
        include: this.threadListInclude(),
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: limit,
      }),
      this.db.bookingThread.count({ where }),
    ]);

    // Map messages[0] → lastMessage for thread preview
    const mapped = threads.map((t) => {
      const { messages, ...rest } = t;
      return { ...rest, lastMessage: messages?.[0] ?? null };
    });

    return {
      success: true,
      data: {
        threads: mapped,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single thread with all messages.
   */
  async getThread(threadId: string, userId: string) {
    const thread = await this.getThreadById(threadId, userId);
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    // Mark messages as read for this user
    await this.db.threadMessage.updateMany({
      where: {
        threadId,
        senderUserId: { not: userId },
        isRead: false,
      },
      data: { isRead: true },
    });

    return { success: true, data: thread };
  }

  // ─── Messaging ──────────────────────────────────────────

  /**
   * Send a text message in a thread. Both client and artisan can send.
   */
  async sendMessage(threadId: string, userId: string, dto: SendMessageDto) {
    const thread = await this.findAndValidateThread(threadId, userId);

    if (thread.status === 'CLOSED' || thread.status === 'BOOKED') {
      throw new BadRequestException(
        'Cannot send messages in a closed or booked thread',
      );
    }

    const senderRole = this.getSenderRole(thread, userId);

    const message = await this.db.$transaction(async (tx) => {
      const msg = await tx.threadMessage.create({
        data: {
          threadId,
          senderUserId: userId,
          senderRole,
          type: 'TEXT',
          content: dto.content,
        },
      });

      // Update thread lastMessageAt
      await tx.bookingThread.update({
        where: { id: threadId },
        data: { lastMessageAt: new Date() },
      });

      return msg;
    });

    // SSE: notify other participant
    this.events.emit('new_message', threadId, {
      message,
      senderUserId: userId,
      senderRole,
    });

    // Notification: new message
    this.notifications
      .dispatchToThreadRecipient(
        threadId,
        userId,
        'THREAD_NEW_MESSAGE',
        'New Message',
        dto.content.slice(0, 100),
      )
      .catch(() => {});

    const webUrl = process.env.CONNECT_WEB_URL ?? '';
    this.emailThreadRecipient(
      threadId,
      userId,
      'New Message',
      `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="margin-bottom:8px">New Message</h2>
  <p>You have a new message in your booking thread.</p>
  <blockquote style="border-left:3px solid #ccc;margin:16px 0;padding:8px 16px;color:#555">${dto.content.slice(0, 200)}</blockquote>
  <a href="${webUrl}/connect/artisan/threads/${threadId}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:6px">View Thread</a>
</div>`,
    ).catch(() => {});

    return { success: true, message: 'Message sent', data: message };
  }

  /**
   * Artisan sends a structured proposal in a thread.
   */
  async sendProposal(
    threadId: string,
    userId: string,
    profileId: string,
    dto: SendProposalDto,
  ) {
    const thread = await this.findAndValidateThread(threadId, userId);
    const artisan = await this.findOwnArtisan(userId, profileId);

    // Only the artisan on this thread can send proposals
    if (thread.artisanId !== artisan.id) {
      throw new ForbiddenException('Only the artisan can send proposals');
    }

    if (thread.status === 'CLOSED' || thread.status === 'BOOKED') {
      throw new BadRequestException(
        'Cannot send proposals in a closed or booked thread',
      );
    }

    // Validate service if provided
    if (dto.serviceId) {
      const service = await this.db.artisanService.findFirst({
        where: { id: dto.serviceId, artisanId: artisan.id, isActive: true },
      });
      if (!service) {
        throw new NotFoundException('Service not found or not active');
      }
    }

    const proposalData = {
      serviceId: dto.serviceId || thread.serviceId || null,
      price: dto.price,
      currency: dto.currency || 'NGN',
      date: dto.date,
      time: dto.time || null,
      duration: dto.duration || null,
      paymentPreference: dto.paymentPreference || 'WALLET',
      paymentTiming: dto.paymentTiming || 'ON_COMPLETION',
      note: dto.note || null,
    };

    const message = await this.db.$transaction(async (tx) => {
      const msg = await tx.threadMessage.create({
        data: {
          threadId,
          senderUserId: userId,
          senderRole: 'ARTISAN',
          type: 'PROPOSAL',
          content: dto.note || `Proposal: ₦${dto.price} on ${dto.date}`,
          proposalData: proposalData as unknown as Prisma.InputJsonValue,
        },
      });

      // Update thread status
      await tx.bookingThread.update({
        where: { id: threadId },
        data: {
          status: 'PROPOSAL_SENT',
          lastMessageAt: new Date(),
          // Optionally link the service
          serviceId: dto.serviceId || thread.serviceId,
        },
      });

      return msg;
    });

    // SSE: notify client about new proposal
    this.events.emit('new_message', threadId, {
      message,
      senderUserId: userId,
      senderRole: 'ARTISAN',
    });
    this.events.emit('status_changed', threadId, {
      status: 'PROPOSAL_SENT',
    });

    // Notification: proposal received by client
    this.notifications
      .dispatchToThreadRecipient(
        threadId,
        userId,
        'THREAD_PROPOSAL_RECEIVED',
        'New Proposal Received',
        `You received a proposal for ₦${dto.price}`,
      )
      .catch(() => {});

    const webUrl = process.env.CONNECT_WEB_URL ?? '';
    this.emailThreadRecipient(
      threadId,
      userId,
      'New Proposal Received',
      `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="margin-bottom:8px">New Proposal Received</h2>
  <p>You have received a new proposal.</p>
  <table style="border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:6px 12px 6px 0;color:#888">Amount</td><td style="padding:6px 0"><strong>₦${dto.price}</strong></td></tr>
    ${dto.date ? `<tr><td style="padding:6px 12px 6px 0;color:#888">Date</td><td style="padding:6px 0">${dto.date}</td></tr>` : ''}
    ${dto.time ? `<tr><td style="padding:6px 12px 6px 0;color:#888">Time</td><td style="padding:6px 0">${dto.time}</td></tr>` : ''}
  </table>
  ${dto.note ? `<blockquote style="border-left:3px solid #ccc;margin:16px 0;padding:8px 16px;color:#555">${dto.note}</blockquote>` : ''}
  <a href="${webUrl}/connect/artisan/threads/${threadId}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:6px">View Proposal</a>
</div>`,
    ).catch(() => {});

    return { success: true, message: 'Proposal sent', data: message };
  }

  /**
   * Client accepts a proposal — creates a Booking from proposal data.
   */
  async acceptProposal(
    threadId: string,
    userId: string,
    dto: AcceptProposalDto,
    token: string,
  ) {
    const thread = await this.findAndValidateThread(threadId, userId);

    // Only the client on this thread can accept proposals
    if (thread.clientUserId !== userId) {
      throw new ForbiddenException('Only the client can accept proposals');
    }

    if (thread.status !== 'PROPOSAL_SENT') {
      throw new BadRequestException('No pending proposal to accept');
    }

    // Find the proposal message
    const proposalMsg = await this.db.threadMessage.findFirst({
      where: {
        id: dto.messageId,
        threadId,
        type: 'PROPOSAL',
      },
    });
    if (!proposalMsg || !proposalMsg.proposalData) {
      throw new NotFoundException('Proposal not found');
    }

    const proposal = proposalMsg.proposalData as Record<string, unknown>;

    // Create booking + update thread in a transaction
    const result = await this.db.$transaction(async (tx) => {
      const booking = await tx.booking.create({
        data: {
          artisanId: thread.artisanId,
          serviceId: (proposal.serviceId as string) || null,
          customerUserId: userId,
          customerProfileId: thread.clientProfileId || null,
          customerName: thread.clientName || null,
          customerPhone: thread.clientPhone || null,
          scheduledDate: proposal.date
            ? new Date(proposal.date as string)
            : null,
          scheduledTime: (proposal.time as string) || null,
          duration: (proposal.duration as number) || null,
          agreedPrice:
            proposal.price != null
              ? new Prisma.Decimal(proposal.price as number)
              : null,
          currency: (proposal.currency as string) || 'NGN',
          paymentMethod:
            (proposal.paymentPreference as string) === 'OFFLINE'
              ? 'OFFLINE'
              : 'WALLET',
          paymentTiming:
            (proposal.paymentTiming as string) === 'UPFRONT'
              ? 'UPFRONT'
              : 'ON_COMPLETION',
          status: 'CONFIRMED',
          note: (proposal.note as string) || null,
        },
      });

      // Update thread to BOOKED state
      await tx.bookingThread.update({
        where: { id: threadId },
        data: {
          status: 'BOOKED',
          bookingId: booking.id,
          lastMessageAt: new Date(),
        },
      });

      // Add system message
      await tx.threadMessage.create({
        data: {
          threadId,
          senderUserId: userId,
          senderRole: 'CLIENT',
          type: 'SYSTEM',
          content: 'Proposal accepted — booking confirmed!',
        },
      });

      return booking;
    });

    // Best-effort: create the wallet-nest payment intent for WALLET-method
    // bookings via the same atomic-claim path executeWalletPayment uses.
    // Never blocks acceptance — if this fails, the execute route lazily
    // creates the intent later.
    if (result.paymentMethod === 'WALLET') {
      try {
        await this.ensurePaymentIntent(result, token);
      } catch {
        // leave paymentReference null; executeWalletPayment self-heals
      }
    }

    // SSE: notify artisan about acceptance
    this.events.emit('status_changed', threadId, {
      status: 'BOOKED',
      booking: result,
    });

    // Notification: proposal accepted / booking confirmed
    this.notifications
      .dispatchToThreadRecipient(
        threadId,
        userId,
        'THREAD_PROPOSAL_ACCEPTED',
        'Proposal Accepted',
        'Your proposal has been accepted — booking confirmed!',
      )
      .catch(() => {});

    const webUrl = process.env.CONNECT_WEB_URL ?? '';
    this.emailThreadRecipient(
      threadId,
      userId,
      'Proposal Accepted — Booking Confirmed!',
      `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="margin-bottom:8px">Booking Confirmed!</h2>
  <p>Your proposal has been accepted and the booking is now confirmed.</p>
  <a href="${webUrl}/connect/artisan/threads/${threadId}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:6px">View Booking</a>
</div>`,
    ).catch(() => {});

    return {
      success: true,
      message: 'Proposal accepted, booking created',
      data: result,
    };
  }

  /**
   * Client declines a proposal.
   */
  async declineProposal(
    threadId: string,
    userId: string,
    dto: DeclineProposalDto,
  ) {
    const thread = await this.findAndValidateThread(threadId, userId);

    if (thread.clientUserId !== userId) {
      throw new ForbiddenException('Only the client can decline proposals');
    }

    if (thread.status !== 'PROPOSAL_SENT') {
      throw new BadRequestException('No pending proposal to decline');
    }

    // Verify the message exists
    const proposalMsg = await this.db.threadMessage.findFirst({
      where: { id: dto.messageId, threadId, type: 'PROPOSAL' },
    });
    if (!proposalMsg) {
      throw new NotFoundException('Proposal not found');
    }

    await this.db.$transaction(async (tx) => {
      // Revert thread to OPEN so artisan can send a new proposal
      await tx.bookingThread.update({
        where: { id: threadId },
        data: {
          status: 'OPEN',
          lastMessageAt: new Date(),
        },
      });

      // System message
      await tx.threadMessage.create({
        data: {
          threadId,
          senderUserId: userId,
          senderRole: 'CLIENT',
          type: 'SYSTEM',
          content: dto.reason
            ? `Proposal declined: ${dto.reason}`
            : 'Proposal declined',
        },
      });
    });

    // SSE: notify artisan about decline
    this.events.emit('status_changed', threadId, {
      status: 'OPEN',
      reason: dto.reason || null,
    });

    // Notification: proposal declined
    this.notifications
      .dispatchToThreadRecipient(
        threadId,
        userId,
        'THREAD_PROPOSAL_DECLINED',
        'Proposal Declined',
        dto.reason
          ? `Your proposal was declined: ${dto.reason}`
          : 'Your proposal was declined',
      )
      .catch(() => {});

    const webUrl = process.env.CONNECT_WEB_URL ?? '';
    this.emailThreadRecipient(
      threadId,
      userId,
      'Proposal Declined',
      `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="margin-bottom:8px">Proposal Declined</h2>
  <p>Your proposal has been declined.</p>
  ${dto.reason ? `<blockquote style="border-left:3px solid #ccc;margin:16px 0;padding:8px 16px;color:#555">${dto.reason}</blockquote>` : ''}
  <p>You can send a revised proposal if you'd like.</p>
  <a href="${webUrl}/connect/artisan/threads/${threadId}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:6px">View Thread</a>
</div>`,
    ).catch(() => {});

    return { success: true, message: 'Proposal declined' };
  }

  /**
   * Either party can close a thread.
   */
  async closeThread(threadId: string, userId: string) {
    const thread = await this.findAndValidateThread(threadId, userId);

    if (thread.status === 'CLOSED') {
      throw new BadRequestException('Thread is already closed');
    }

    const role = this.getSenderRole(thread, userId);

    await this.db.$transaction(async (tx) => {
      await tx.bookingThread.update({
        where: { id: threadId },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closedBy: role === 'CLIENT' ? 'client' : 'artisan',
        },
      });

      await tx.threadMessage.create({
        data: {
          threadId,
          senderUserId: userId,
          senderRole: role,
          type: 'SYSTEM',
          content: `Thread closed by ${role === 'CLIENT' ? 'client' : 'artisan'}`,
        },
      });
    });

    // SSE: notify other participant
    this.events.emit('thread_closed', threadId, {
      closedBy: role,
    });

    // Notification: thread closed
    this.notifications
      .dispatchToThreadRecipient(
        threadId,
        userId,
        'BOOKING_CANCELLED',
        'Thread Closed',
        `Thread was closed by the ${role === 'CLIENT' ? 'client' : 'artisan'}`,
      )
      .catch(() => {});

    const webUrl = process.env.CONNECT_WEB_URL ?? '';
    this.emailThreadRecipient(
      threadId,
      userId,
      'Thread Closed',
      `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="margin-bottom:8px">Thread Closed</h2>
  <p>This booking thread has been closed by the ${role === 'CLIENT' ? 'client' : 'artisan'}.</p>
  <a href="${webUrl}/connect/artisan/threads/${threadId}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:6px">View Thread</a>
</div>`,
    ).catch(() => {});

    return { success: true, message: 'Thread closed' };
  }

  // ─── Payment Confirmation ───────────────────────────────

  /**
   * Client confirms they have sent payment.
   */
  async confirmPaymentSent(
    bookingId: string,
    userId: string,
    dto: ConfirmPaymentDto,
  ) {
    const booking = await this.db.booking.findFirst({
      where: {
        id: bookingId,
        customerUserId: userId,
      },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.clientPaymentConfirmed) {
      throw new BadRequestException('Payment already confirmed by you');
    }

    const updated = await this.db.$transaction(async (tx) => {
      const result = await tx.booking.update({
        where: { id: bookingId },
        data: {
          clientPaymentConfirmed: true,
          clientPaymentConfirmedAt: new Date(),
          paymentReference: dto.reference || booking.paymentReference,
        },
      });

      // If both sides confirmed, mark as paid
      if (result.artisanPaymentConfirmed) {
        await tx.booking.update({
          where: { id: bookingId },
          data: { isPaid: true, paidAt: new Date() },
        });
      }

      // Add system message if thread exists
      if (booking.id) {
        const thread = await tx.bookingThread.findFirst({
          where: { bookingId: booking.id },
        });
        if (thread) {
          await tx.threadMessage.create({
            data: {
              threadId: thread.id,
              senderUserId: userId,
              senderRole: 'CLIENT',
              type: 'SYSTEM',
              content: 'Client confirmed payment sent',
            },
          });
        }
      }

      return result;
    });

    // SSE: notify artisan about client payment confirmation
    const paymentThread = await this.db.bookingThread.findFirst({
      where: { bookingId },
    });
    if (paymentThread) {
      this.events.emit('payment_update', paymentThread.id, {
        action: 'payment_sent',
        clientConfirmed: true,
        artisanConfirmed: updated.artisanPaymentConfirmed,
        isPaid: updated.artisanPaymentConfirmed,
      });

      // Notification: payment sent confirmed
      this.notifications
        .dispatchToThreadRecipient(
          paymentThread.id,
          userId,
          'PAYMENT_SENT_CONFIRMED',
          'Payment Sent',
          'Client has confirmed that payment was sent',
        )
        .catch(() => {});

      const webUrl = process.env.CONNECT_WEB_URL ?? '';
      this.emailThreadRecipient(
        paymentThread.id,
        userId,
        'Payment Sent Confirmation',
        `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="margin-bottom:8px">Payment Sent</h2>
  <p>The client has confirmed that payment has been sent for your booking.</p>
  <a href="${webUrl}/connect/artisan/threads/${paymentThread.id}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:6px">View Booking</a>
</div>`,
      ).catch(() => {});
    }

    return {
      success: true,
      message: 'Payment confirmation recorded',
      data: {
        clientConfirmed: true,
        artisanConfirmed: updated.artisanPaymentConfirmed,
        isPaid: updated.artisanPaymentConfirmed, // Fully paid if both confirmed
      },
    };
  }

  /**
   * Artisan confirms they have received payment.
   */
  async confirmPaymentReceived(
    bookingId: string,
    userId: string,
    profileId: string,
    _dto?: ConfirmPaymentDto,
  ) {
    const artisan = await this.findOwnArtisan(userId, profileId);

    const booking = await this.db.booking.findFirst({
      where: {
        id: bookingId,
        artisanId: artisan.id,
      },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.artisanPaymentConfirmed) {
      throw new BadRequestException('Payment already confirmed by you');
    }

    const updated = await this.db.$transaction(async (tx) => {
      const result = await tx.booking.update({
        where: { id: bookingId },
        data: {
          artisanPaymentConfirmed: true,
          artisanPaymentConfirmedAt: new Date(),
        },
      });

      // If both sides confirmed, mark as paid
      if (result.clientPaymentConfirmed) {
        await tx.booking.update({
          where: { id: bookingId },
          data: { isPaid: true, paidAt: new Date() },
        });
      }

      // Add system message if thread exists
      const thread = await tx.bookingThread.findFirst({
        where: { bookingId: booking.id },
      });
      if (thread) {
        await tx.threadMessage.create({
          data: {
            threadId: thread.id,
            senderUserId: userId,
            senderRole: 'ARTISAN',
            type: 'SYSTEM',
            content: 'Artisan confirmed payment received',
          },
        });
      }

      return result;
    });

    // SSE: notify client about artisan payment receipt
    const receiptThread = await this.db.bookingThread.findFirst({
      where: { bookingId },
    });
    if (receiptThread) {
      this.events.emit('payment_update', receiptThread.id, {
        action: 'payment_received',
        clientConfirmed: updated.clientPaymentConfirmed,
        artisanConfirmed: true,
        isPaid: updated.clientPaymentConfirmed,
      });

      // Notification: payment received confirmed
      this.notifications
        .dispatchToThreadRecipient(
          receiptThread.id,
          userId,
          'PAYMENT_RECEIVED_CONFIRMED',
          'Payment Received',
          'Artisan has confirmed receiving your payment',
        )
        .catch(() => {});

      const webUrl = process.env.CONNECT_WEB_URL ?? '';
      this.emailThreadRecipient(
        receiptThread.id,
        userId,
        'Payment Received Confirmation',
        `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="margin-bottom:8px">Payment Received</h2>
  <p>The artisan has confirmed receiving your payment. Your booking is now complete.</p>
  <a href="${webUrl}/connect/artisan/threads/${receiptThread.id}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:6px">View Booking</a>
</div>`,
      ).catch(() => {});
    }

    return {
      success: true,
      message: 'Payment receipt confirmed',
      data: {
        clientConfirmed: updated.clientPaymentConfirmed,
        artisanConfirmed: true,
        isPaid: updated.clientPaymentConfirmed, // Fully paid if both confirmed
      },
    };
  }

  /**
   * Either party can dispute a payment.
   */
  async disputePayment(
    bookingId: string,
    userId: string,
    dto: DisputePaymentDto,
  ) {
    const booking = await this.db.booking.findFirst({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Verify the user is a participant
    const isClient = booking.customerUserId === userId;
    const isArtisan = await this.isArtisanOwner(booking.artisanId, userId);

    if (!isClient && !isArtisan) {
      throw new ForbiddenException('You are not a participant of this booking');
    }

    if (booking.paymentDisputed) {
      throw new BadRequestException('Payment is already under dispute');
    }

    const updated = await this.db.$transaction(async (tx) => {
      const result = await tx.booking.update({
        where: { id: bookingId },
        data: {
          paymentDisputed: true,
          paymentDisputeReason: dto.reason,
          paymentDisputedAt: new Date(),
          paymentDisputedBy: isClient ? 'CLIENT' : 'ARTISAN',
        },
      });

      // Add system message if thread exists
      const thread = await tx.bookingThread.findFirst({
        where: { bookingId },
      });
      if (thread) {
        await tx.threadMessage.create({
          data: {
            threadId: thread.id,
            senderUserId: userId,
            senderRole: isClient ? 'CLIENT' : 'ARTISAN',
            type: 'SYSTEM',
            content: `Payment disputed: ${dto.reason}`,
          },
        });
      }

      return result;
    });

    // SSE: notify other participant about dispute
    const disputeThread = await this.db.bookingThread.findFirst({
      where: { bookingId },
    });
    if (disputeThread) {
      this.events.emit('payment_update', disputeThread.id, {
        action: 'payment_disputed',
        reason: dto.reason,
        disputedBy: isClient ? 'CLIENT' : 'ARTISAN',
      });

      // Notification: payment disputed
      this.notifications
        .dispatchToThreadRecipient(
          disputeThread.id,
          userId,
          'PAYMENT_DISPUTED',
          'Payment Disputed',
          `Payment has been disputed: ${dto.reason}`,
        )
        .catch(() => {});

      const webUrl = process.env.CONNECT_WEB_URL ?? '';
      this.emailThreadRecipient(
        disputeThread.id,
        userId,
        'Payment Dispute Raised',
        `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="margin-bottom:8px">Payment Dispute Raised</h2>
  <p>A payment dispute has been raised for your booking.</p>
  <blockquote style="border-left:3px solid #e53e3e;margin:16px 0;padding:8px 16px;color:#555">${dto.reason}</blockquote>
  <p>Our team will review this dispute. Please ensure your records are up to date.</p>
  <a href="${webUrl}/connect/artisan/threads/${disputeThread.id}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:6px">View Thread</a>
</div>`,
      ).catch(() => {});
    }

    return {
      success: true,
      message: 'Payment dispute raised',
      data: updated,
    };
  }

  /**
   * Ensures a WALLET-method booking has a wallet-nest payment intent,
   * lazily creating one if acceptProposal's best-effort attempt failed.
   */
  private async ensurePaymentIntent(
    booking: {
      id: string;
      artisanId: string;
      serviceId: string | null;
      customerUserId: string;
      agreedPrice: Prisma.Decimal | null;
      currency: string;
      paymentReference: string | null;
    },
    token: string,
  ): Promise<string> {
    if (booking.paymentReference) {
      return booking.paymentReference;
    }

    const artisan = await this.db.artisan.findUnique({
      where: { id: booking.artisanId },
      select: { userId: true },
    });
    if (!artisan) {
      throw new NotFoundException('Artisan not found for this booking');
    }

    const intentRes = await this.walletClient.createArtisanPaymentIntent(
      {
        senderUserId: booking.customerUserId,
        receiverUserId: artisan.userId,
        amount: booking.agreedPrice ? Number(booking.agreedPrice) : 0,
        currency: booking.currency,
        artisanId: booking.artisanId,
        serviceId: booking.serviceId || undefined,
        bookingId: booking.id,
        sourceReference: booking.id,
      },
      token,
    );
    if (!intentRes.success || !intentRes.data?.intent?.id) {
      throw new BadRequestException(
        intentRes.message || 'Could not create wallet payment for this booking',
      );
    }
    const intentId = intentRes.data.intent.id as string;

    // Atomically claim the paymentReference slot. Two concurrent callers
    // (double-tap, client retry racing the original request) can both reach
    // this point with paymentReference still null and both create a wallet
    // intent — without this guard both would go on to execute their own
    // intent, charging the customer twice. Only the request that actually
    // flips paymentReference from null wins; the loser cancels its
    // redundant intent and defers to the winner's.
    const claim = await this.db.booking.updateMany({
      where: { id: booking.id, paymentReference: null },
      data: { paymentReference: intentId },
    });
    if (claim.count === 0) {
      this.walletClient
        .cancelPaymentIntent(booking.customerUserId, intentId, token)
        .catch(() => {});
      const fresh = await this.db.booking.findUnique({
        where: { id: booking.id },
        select: { paymentReference: true },
      });
      return fresh!.paymentReference!;
    }

    return intentId;
  }

  /**
   * Customer executes the wallet payment for a booking (PIN-confirmed).
   */
  async executeWalletPayment(
    bookingId: string,
    userId: string,
    dto: ExecuteWalletPaymentDto,
    token: string,
  ) {
    const booking = await this.db.booking.findFirst({
      where: { id: bookingId, customerUserId: userId },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.paymentMethod !== 'WALLET') {
      throw new BadRequestException('This booking is not set up for wallet payment');
    }
    if (booking.isPaid) {
      throw new BadRequestException('This booking has already been paid');
    }

    const intentId = await this.ensurePaymentIntent(booking, token);

    const result = await this.walletClient.executePaymentIntent(
      { userId, intentId, pin: dto.pin, confirmFraud: dto.confirmFraud },
      token,
    );

    if (result.success && result.data?.intent?.status === 'EXECUTED') {
      await this.db.booking.update({
        where: { id: bookingId },
        data: {
          isPaid: true,
          paidAt: new Date(),
          clientPaymentConfirmed: true,
          artisanPaymentConfirmed: true,
        },
      });

      const thread = await this.db.bookingThread.findFirst({
        where: { bookingId },
      });
      if (thread) {
        this.events.emit('payment_update', thread.id, {
          action: 'wallet_payment_executed',
          clientConfirmed: true,
          artisanConfirmed: true,
          isPaid: true,
        });
        this.notifications
          .dispatchToThreadRecipient(
            thread.id,
            userId,
            'PAYMENT_RECEIVED_CONFIRMED',
            'Payment Received',
            'Wallet payment completed for this booking',
          )
          .catch(() => {});
      }
    }

    return result;
  }

  /**
   * Cancel the wallet payment intent for a booking (either participant).
   */
  async cancelWalletPayment(bookingId: string, userId: string, token: string) {
    const booking = await this.db.booking.findFirst({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    const isClient = booking.customerUserId === userId;
    const isArtisan = await this.isArtisanOwner(booking.artisanId, userId);
    if (!isClient && !isArtisan) {
      throw new ForbiddenException('You are not a participant of this booking');
    }
    if (!booking.paymentReference) {
      throw new BadRequestException('No wallet payment exists for this booking');
    }

    return this.walletClient.cancelPaymentIntent(
      userId,
      booking.paymentReference,
      token,
    );
  }

  /**
   * Get the wallet payment intent status for a booking (either participant).
   */
  async getWalletPaymentStatus(bookingId: string, userId: string, token: string) {
    const booking = await this.db.booking.findFirst({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    const isClient = booking.customerUserId === userId;
    const isArtisan = await this.isArtisanOwner(booking.artisanId, userId);
    if (!isClient && !isArtisan) {
      throw new ForbiddenException('You are not a participant of this booking');
    }
    if (!booking.paymentReference) {
      return { success: true, data: null };
    }

    return this.walletClient.getPaymentIntent(
      userId,
      booking.paymentReference,
      token,
    );
  }

  // ─── Unread Counts ──────────────────────────────────────

  /**
   * Get unread message count for the user across all threads.
   */
  async getUnreadCount(userId: string) {
    const count = await this.db.threadMessage.count({
      where: {
        senderUserId: { not: userId },
        isRead: false,
        thread: {
          OR: [{ clientUserId: userId }, { artisan: { userId } }],
        },
      },
    });

    return { success: true, data: { unreadCount: count } };
  }

  // ─── Helpers ────────────────────────────────────────────

  private async emailThreadRecipient(
    threadId: string,
    senderUserId: string,
    subject: string,
    html: string,
  ): Promise<void> {
    const thread = await this.db.bookingThread.findUnique({
      where: { id: threadId },
      select: {
        clientUserId: true,
        artisan: { select: { userId: true } },
      },
    });
    if (!thread) return;

    const recipientUserId =
      thread.clientUserId === senderUserId
        ? thread.artisan?.userId
        : thread.clientUserId;
    if (!recipientUserId) return;

    const email = await this.authClient.getUserEmail(recipientUserId);
    if (!email) return;
    await this.mail.sendEmail({ to: email, subject, html });
  }

  private async findAndValidateThread(threadId: string, userId: string) {
    const thread = await this.db.bookingThread.findUnique({
      where: { id: threadId },
      include: { artisan: true },
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    // User must be either the client or the artisan
    const isParticipant =
      thread.clientUserId === userId || thread.artisan.userId === userId;
    if (!isParticipant) {
      throw new ForbiddenException(
        'You are not a participant of this conversation',
      );
    }

    return thread;
  }

  private getSenderRole(
    thread: { clientUserId: string; artisan: { userId: string } },
    userId: string,
  ): 'CLIENT' | 'ARTISAN' {
    if (thread.clientUserId === userId) return 'CLIENT';
    if (thread.artisan.userId === userId) return 'ARTISAN';
    throw new ForbiddenException('Not a participant');
  }

  private async findOwnArtisan(userId: string, profileId: string) {
    const artisan = await this.db.artisan.findFirst({
      where: { userId, profileId },
    });
    if (!artisan) {
      throw new NotFoundException('Artisan profile not found');
    }
    return artisan;
  }

  private async isArtisanOwner(
    artisanId: string,
    userId: string,
  ): Promise<boolean> {
    const artisan = await this.db.artisan.findFirst({
      where: { id: artisanId, userId },
    });
    return !!artisan;
  }

  private async getThreadById(threadId: string, userId: string) {
    const thread = await this.db.bookingThread.findUnique({
      where: { id: threadId },
      include: this.threadDetailInclude(),
    });

    if (!thread) return null;

    // Verify participant
    const isParticipant =
      thread.clientUserId === userId || thread.artisan.userId === userId;
    if (!isParticipant) return null;

    return thread;
  }

  private threadListInclude() {
    return {
      artisan: {
        include: {
          profile: {
            select: {
              id: true,
              name: true,
              profilePhoto: true,
              slug: true,
            },
          },
        },
      },
      service: {
        select: { id: true, name: true, price: true, currency: true },
      },
      booking: {
        select: {
          id: true,
          status: true,
          scheduledDate: true,
          agreedPrice: true,
          isPaid: true,
        },
      },
      messages: {
        orderBy: { createdAt: 'desc' as const },
        take: 1, // Only last message for preview
      },
      _count: {
        select: { messages: true },
      },
    };
  }

  private threadDetailInclude() {
    return {
      artisan: {
        include: {
          profile: {
            select: {
              id: true,
              name: true,
              profilePhoto: true,
              slug: true,
            },
          },
        },
      },
      service: true,
      booking: {
        select: {
          id: true,
          status: true,
          scheduledDate: true,
          scheduledTime: true,
          duration: true,
          agreedPrice: true,
          currency: true,
          paymentMethod: true,
          paymentTiming: true,
          isPaid: true,
          clientPaymentConfirmed: true,
          clientPaymentConfirmedAt: true,
          artisanPaymentConfirmed: true,
          artisanPaymentConfirmedAt: true,
          paymentDisputed: true,
          paymentDisputeReason: true,
        },
      },
      messages: {
        orderBy: { createdAt: 'asc' as const },
      },
    };
  }
}
