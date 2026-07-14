import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { CpAuditLogService } from '../audit-logs/cp-audit-log.service';
import { CpNotificationsService } from '../notifications/notifications.service';
import { CpSubscriptionsService } from '../subscriptions/subscriptions.service';
import {
  CpRole,
  CpMemberStatus,
  CpNotificationType,
  CpSubscriptionPlan,
  CpSubscriptionStatus,
} from '../../generated/prisma/client';
import { InviteAcceptedWebhookDto } from './dto/invite-accepted-webhook.dto';

@Injectable()
export class CpWebhooksService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auditLog: CpAuditLogService,
    private readonly notifications: CpNotificationsService,
    private readonly subscriptions: CpSubscriptionsService,
  ) {}

  async handleInviteAccepted(dto: InviteAcceptedWebhookDto): Promise<void> {
    // Hash incoming token to compare with stored hash
    const hashedToken = createHash('sha256').update(dto.token).digest('hex');

    const invite = await this.db.cpWorkspaceInvite.findFirst({
      where: { token: hashedToken },
    });

    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.status !== 'PENDING') {
      throw new BadRequestException('Invite is not in PENDING state');
    }
    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('Invite has expired');
    }
    if (invite.workspaceId !== dto.workspaceId) {
      throw new BadRequestException('Workspace mismatch');
    }

    await this.db.$transaction(async (tx) => {
      // Update invite status
      await tx.cpWorkspaceInvite.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });

      // Create workspace member
      const member = await tx.cpWorkspaceMember.create({
        data: {
          workspaceId: invite.workspaceId,
          authUserId: dto.authUserId,
          role: invite.role as CpRole,
          status: CpMemberStatus.ACTIVE,
          joinedAt: new Date(),
        },
      });

      // Create staff profile
      const staffProfile = await tx.cpStaffProfile.create({
        data: {
          workspaceId: invite.workspaceId,
          memberId: member.id,
          authUserId: dto.authUserId,
          name: dto.email.split('@')[0],
          email: invite.email,
        },
      });

      // Add to workspace group conversation if exists
      const groupConversation = await tx.cpConversation.findFirst({
        where: {
          workspaceId: invite.workspaceId,
          type: 'WORKSPACE_GROUP',
          isAutoCreated: true,
        },
      });
      if (groupConversation) {
        await tx.cpConversationParticipant.create({
          data: {
            conversationId: groupConversation.id,
            authUserId: dto.authUserId,
            role: 'MEMBER',
          },
        });
      }

      return { member, staffProfile };
    });

    // Non-blocking notifications
    void this.notifications.send({
      recipientAuthId: dto.authUserId,
      type: CpNotificationType.WORKSPACE_INVITE_ACCEPTED,
      title: 'Welcome to the workspace',
      message: 'Your invitation has been accepted and account set up',
      workspaceId: invite.workspaceId,
    });
  }

  // ---------------------------------------------------------------------------
  // Paystack webhook handler
  // ---------------------------------------------------------------------------

  async handlePaystackEvent(signature: string, rawBody: Buffer): Promise<void> {
    const secret = process.env.PAYSTACK_SECRET_KEY ?? '';
    const expected = createHmac('sha512', secret).update(rawBody).digest('hex');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      throw new UnauthorizedException('Invalid Paystack webhook signature');
    }

    let event: { event: string; data: Record<string, unknown> };
    try {
      event = JSON.parse(rawBody.toString('utf8')) as typeof event;
    } catch {
      throw new BadRequestException('Invalid JSON body');
    }

    switch (event.event) {
      case 'charge.success':
        await this.handlePaystackChargeSuccess(event.data);
        break;
      case 'subscription.create':
        await this.handlePaystackSubscriptionCreate(event.data);
        break;
      case 'subscription.disable':
        await this.handlePaystackSubscriptionDisable(event.data);
        break;
      case 'invoice.payment_failed':
        await this.handlePaystackInvoicePaymentFailed(event.data);
        break;
      default:
        // Unknown event — ignore
        break;
    }
  }

  private async handlePaystackChargeSuccess(
    data: Record<string, unknown>,
  ): Promise<void> {
    const metadata = data['metadata'] as Record<string, unknown> | null;
    const organizationId = metadata?.['organizationId'] as string | undefined;
    const plan = metadata?.['plan'] as CpSubscriptionPlan | undefined;

    if (!organizationId || !plan) return;

    const sub = await this.db.cpSubscription.findUnique({
      where: { organizationId },
    });
    if (!sub) return;

    await this.db.cpSubscription.update({
      where: { id: sub.id },
      data: {
        plan,
        status: CpSubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
      },
    });
  }

  private async handlePaystackSubscriptionCreate(
    data: Record<string, unknown>,
  ): Promise<void> {
    const customerCode = (data['customer'] as Record<string, unknown> | null)?.[
      'customer_code'
    ] as string | undefined;
    const subCode = data['subscription_code'] as string | undefined;
    const planObj = data['plan'] as Record<string, unknown> | null;
    const planName = planObj?.['name'] as string | undefined;
    const nextPaymentDate = data['next_payment_date'] as string | undefined;

    if (!customerCode || !subCode) return;

    const sub = await this.db.cpSubscription.findFirst({
      where: { paystackCustomerCode: customerCode },
    });
    if (!sub) return;

    const resolvedPlan = this.resolvePaystackPlan(planName);

    await this.db.cpSubscription.update({
      where: { id: sub.id },
      data: {
        paystackSubCode: subCode,
        plan: resolvedPlan ?? sub.plan,
        status: CpSubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: nextPaymentDate
          ? new Date(nextPaymentDate)
          : undefined,
      },
    });
  }

  private async handlePaystackSubscriptionDisable(
    data: Record<string, unknown>,
  ): Promise<void> {
    const subCode = data['subscription_code'] as string | undefined;
    if (!subCode) return;

    const sub = await this.db.cpSubscription.findFirst({
      where: { paystackSubCode: subCode },
    });
    if (!sub) return;

    await this.db.cpSubscription.update({
      where: { id: sub.id },
      data: {
        status: CpSubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });
  }

  private async handlePaystackInvoicePaymentFailed(
    data: Record<string, unknown>,
  ): Promise<void> {
    const subCode = (data['subscription'] as Record<string, unknown> | null)?.[
      'subscription_code'
    ] as string | undefined;
    if (!subCode) return;

    const sub = await this.db.cpSubscription.findFirst({
      where: { paystackSubCode: subCode },
    });
    if (!sub) return;

    await this.db.cpSubscription.update({
      where: { id: sub.id },
      data: { status: CpSubscriptionStatus.PAST_DUE },
    });
  }

  private resolvePaystackPlan(
    planName: string | undefined,
  ): CpSubscriptionPlan | null {
    if (!planName) return null;
    const upper = planName.toUpperCase();
    if (upper.includes('BUSINESS')) return CpSubscriptionPlan.BUSINESS;
    if (upper.includes('GROWTH')) return CpSubscriptionPlan.GROWTH;
    if (upper.includes('STARTER')) return CpSubscriptionPlan.STARTER;
    return null;
  }
}
