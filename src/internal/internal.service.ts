import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CpOrganizationsService } from '../connect-plus/organizations/organizations.service';
import { CpWorkspacesService } from '../connect-plus/workspaces/workspaces.service';
import { CpRequestContext } from '../connect-plus/types/cp-request.types';
import {
  CpRole,
  CpMemberStatus,
} from '../generated/prisma/client';

@Injectable()
export class InternalService {
  constructor(
    private readonly db: DatabaseService,
    private readonly organizations: CpOrganizationsService,
    private readonly workspaces: CpWorkspacesService,
  ) {}

  /**
   * Provisions a CpOrganization + CpWorkspace (+ CREATOR membership) for a
   * freshly created isce-auth BUSINESS_USER, so they land directly in a
   * working Connect Plus workspace instead of the manual onboarding wizard.
   * Idempotent — returns the existing org/workspace if one already exists
   * for this authUserId.
   */
  async provisionBusinessOrg(authUserId: string, businessName: string) {
    const existingOrg = await this.db.cpOrganization.findFirst({
      where: { creatorAuthId: authUserId },
    });

    if (existingOrg) {
      const existingWorkspace = await this.db.cpWorkspace.findFirst({
        where: { organizationId: existingOrg.id, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });
      return {
        organizationId: existingOrg.id,
        workspaceId: existingWorkspace?.id ?? null,
        workspaceSlug: existingWorkspace?.slug ?? null,
      };
    }

    const orgCtx: CpRequestContext = {
      authUserId,
      organizationId: '',
      role: CpRole.CREATOR,
    };
    const org = await this.organizations.create(orgCtx, { name: businessName });

    const workspaceCtx: CpRequestContext = {
      authUserId,
      organizationId: org.id,
      role: CpRole.CREATOR,
    };
    const workspace = await this.workspaces.create(workspaceCtx, {
      name: businessName,
    });

    // The creator isn't auto-added as a CpWorkspaceMember by workspace
    // creation — without this, CpContextGuard would lock them out of every
    // workspace-scoped CP route the moment the frontend sends x-workspace-id.
    await this.db.cpWorkspaceMember.create({
      data: {
        workspaceId: workspace.id,
        authUserId,
        role: CpRole.CREATOR,
        status: CpMemberStatus.ACTIVE,
        joinedAt: new Date(),
      },
    });

    return {
      organizationId: org.id,
      workspaceId: workspace.id,
      workspaceSlug: workspace.slug,
    };
  }

  /**
   * Soft-deletes all data owned by `userId` across every connect-nest table.
   *
   * Execution order (parent → children) prevents FK constraint issues:
   *  1. Artisan children first (ArtisanService, PortfolioItem, Booking, Review)
   *  2. Artisan row
   *  3. Profile children (Social, Contact, Notification, SupportRequest,
   *     CardInteraction, ProfileContact, Link, Video, MeetingLink,
   *     AppointmentLink, SpotifyItem, FileItem, Form/Submission,
   *     Wallet[connect])
   *  4. Profile rows
   *
   * Tables without `deletedAt` (ConnectConfig, DeviceProfile,
   * ArtisanCategoryMap, BookingThread, ThreadMessage, Promotion) are left
   * untouched — they become inaccessible once the parent Profile/Artisan
   * is soft-deleted.
   */
  async deleteUserData(userId: string): Promise<{ deleted: boolean }> {
    const now = new Date();

    // ── Step 1: collect artisan IDs for this user ─────────────────────
    const artisanIds = (
      await this.db.artisan.findMany({
        where: { userId },
        select: { id: true },
      })
    ).map((a) => a.id);

    await this.db.$transaction(async (tx) => {
      // ── Artisan-scoped children ──────────────────────────────────────
      if (artisanIds.length > 0) {
        await Promise.all([
          tx.artisanService.updateMany({
            where: { artisanId: { in: artisanIds } },
            data: { deletedAt: now },
          }),
          tx.portfolioItem.updateMany({
            where: { artisanId: { in: artisanIds } },
            data: { deletedAt: now },
          }),
          tx.booking.updateMany({
            where: { artisanId: { in: artisanIds } },
            data: { deletedAt: now },
          }),
          tx.review.updateMany({
            where: { artisanId: { in: artisanIds } },
            data: { deletedAt: now },
          }),
          // Bookings where this user was the CUSTOMER (booked an artisan)
          tx.booking.updateMany({
            where: { customerUserId: userId },
            data: { deletedAt: now },
          }),
          // Reviews left by this user as a reviewer
          tx.review.updateMany({
            where: { reviewerUserId: userId },
            data: { deletedAt: now },
          }),
        ]);

        await tx.artisan.updateMany({
          where: { userId },
          data: { deletedAt: now },
        });
      }

      // ── Profile-scoped children ──────────────────────────────────────
      // Using nested relation filters (Social.user → Profile.userId, etc.)
      await Promise.all([
        tx.social.updateMany({
          where: { user: { userId } },
          data: { deletedAt: now },
        }),
        tx.contact.updateMany({
          where: { owner: { userId } },
          data: { deletedAt: now },
        }),
        tx.notification.updateMany({
          where: { user: { userId } },
          data: { deletedAt: now },
        }),
        tx.supportRequest.updateMany({
          where: { user: { userId } },
          data: { deletedAt: now },
        }),
        tx.cardInteraction.updateMany({
          where: { user: { userId } },
          data: { deletedAt: now },
        }),
        tx.profileContact.updateMany({
          where: { profile: { userId } },
          data: { deletedAt: now },
        }),
        tx.link.updateMany({
          where: { profile: { userId } },
          data: { deletedAt: now },
        }),
        tx.video.updateMany({
          where: { profile: { userId } },
          data: { deletedAt: now },
        }),
        tx.meetingLink.updateMany({
          where: { profile: { userId } },
          data: { deletedAt: now },
        }),
        tx.appointmentLink.updateMany({
          where: { profile: { userId } },
          data: { deletedAt: now },
        }),
        tx.spotifyItem.updateMany({
          where: { profile: { userId } },
          data: { deletedAt: now },
        }),
        tx.fileItem.updateMany({
          where: { profile: { userId } },
          data: { deletedAt: now },
        }),
        tx.wallet.updateMany({
          where: { profile: { userId } },
          data: { deletedAt: now },
        }),
      ]);

      // Form submissions must be soft-deleted before forms
      const profileIds = (
        await tx.profile.findMany({
          where: { userId },
          select: { id: true },
        })
      ).map((p) => p.id);

      if (profileIds.length > 0) {
        await tx.submission.updateMany({
          where: { form: { profileId: { in: profileIds } } },
          data: { deletedAt: now },
        });
        await tx.form.updateMany({
          where: { profileId: { in: profileIds } },
          data: { deletedAt: now },
        });
      }

      // ── Profiles ─────────────────────────────────────────────────────
      await tx.profile.updateMany({
        where: { userId },
        data: { deletedAt: now },
      });
    });

    return { deleted: true };
  }

  /**
   * Returns all connect-nest data for a user, suitable for GDPR data export.
   * Only returns active (non-deleted) records.
   */
  async exportUserData(userId: string) {
    const profiles = await this.db.profile.findMany({
      where: { userId, deletedAt: null },
      include: {
        socials: { where: { deletedAt: null } },
        contacts: { where: { deletedAt: null } },
        links: { where: { deletedAt: null } },
        videos: { where: { deletedAt: null } },
        meetings: { where: { deletedAt: null } },
        appointments: { where: { deletedAt: null } },
        spotifyItems: { where: { deletedAt: null } },
        files: { where: { deletedAt: null } },
        wallets: { where: { deletedAt: null } },
        profileContacts: { where: { deletedAt: null } },
        notifications: { where: { deletedAt: null } },
        supportRequests: { where: { deletedAt: null } },
        cardInteractions: { where: { deletedAt: null } },
        connectConfig: true,
        artisan: {
          include: {
            services: { where: { deletedAt: null } },
            portfolio: { where: { deletedAt: null } },
            categories: { include: { category: true } },
          },
        },
        forms: {
          where: { deletedAt: null },
          include: { submissions: { where: { deletedAt: null } } },
        },
      },
    });

    const customerBookings = await this.db.booking.findMany({
      where: { customerUserId: userId, deletedAt: null },
    });

    return { profiles, customerBookings };
  }
}
