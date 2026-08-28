import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Prisma } from '../generated/prisma/client';
import {
  RegisterArtisanDto,
  UpdateArtisanDto,
  CreateServiceDto,
  UpdateServiceDto,
  AddPortfolioItemDto,
  UpdatePortfolioItemDto,
  UpdateCategoriesDto,
  CreateBookingDto,
  CancelBookingDto,
  CreateReviewDto,
} from './dto/artisan.dto';
import { NotificationDispatcher } from '../notification/notification-dispatcher.service';
import { AuthClientService } from '../auth/auth-client.service';
import { MailClientService } from '../mail/mail-client.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PlanLimitException } from '../subscriptions/exceptions/plan-limit.exception';
import { PlanTier, CpAuditSource } from '../generated/prisma/client';
import { WalletClientService } from '../auth/wallet-client.service';

@Injectable()
export class ArtisanService {
  private readonly logger = new Logger(ArtisanService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly notifications: NotificationDispatcher,
    private readonly authClient: AuthClientService,
    private readonly mail: MailClientService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly walletClient: WalletClientService,
  ) {}

  // ─── Registration ───────────────────────────────────────

  async getRequirements() {
    const settings = await this.getOrCreateSettings();
    const categories = await this.databaseService.artisanCategory.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
    return {
      success: true,
      data: {
        minPortfolioItems: settings.minPortfolioItems,
        maxCategories: settings.maxCategories,
        categories,
        requirements: [
          'Complete profile with display picture',
          'At least 1 service with pricing',
          `At least ${settings.minPortfolioItems} portfolio item(s)`,
          `Select 1-${settings.maxCategories} categories`,
          'Accept terms and conditions',
        ],
      },
    };
  }

  async register(userId: string, dto: RegisterArtisanDto, token: string) {
    // 1. Validate profile ownership
    const profile = await this.databaseService.profile.findFirst({
      where: { id: dto.profileId, userId },
    });
    if (!profile) {
      throw new NotFoundException('Profile not found or not yours');
    }

    // 2. Check not already an artisan
    const existing = await this.databaseService.artisan.findUnique({
      where: { profileId: dto.profileId },
    });
    if (existing) {
      throw new ConflictException(
        'This profile is already registered as an artisan',
      );
    }

    // 3. Validate terms acceptance
    if (!dto.termsAccepted) {
      throw new BadRequestException('You must accept the terms and conditions');
    }

    // 4. Validate categories / custom category
    const settings = await this.getOrCreateSettings();

    // Enforce subscription plan limits for artisan features
    const limits = await this.subscriptionsService.getUserLimits(userId);
    if (!limits.artisanDirectoryEligible) {
      throw new PlanLimitException('artisanDirectoryEligible', PlanTier.PRO_LITE);
    }

    if (dto.categoryIds.length === 0 && !dto.customCategory?.trim()) {
      throw new BadRequestException(
        'Select at least one category or provide a custom category',
      );
    }

    if (dto.categoryIds.length > settings.maxCategories) {
      throw new BadRequestException(
        `Maximum ${settings.maxCategories} categories allowed`,
      );
    }

    // Enforce subscription plan limit on number of categories
    if (dto.categoryIds.length > limits.serviceCategories) {
      throw new PlanLimitException('serviceCategories', PlanTier.PRO_PLUS);
    }

    let categories: { id: string }[] = [];
    if (dto.categoryIds.length > 0) {
      categories = await this.databaseService.artisanCategory.findMany({
        where: { id: { in: dto.categoryIds }, isActive: true },
      });
      if (categories.length !== dto.categoryIds.length) {
        throw new BadRequestException('One or more categories are invalid');
      }
    }

    // 5. Determine initial status
    const status = settings.artisanAutoApproval ? 'ACTIVE' : 'PENDING_REVIEW';

    // 6. Create artisan with services, portfolio, and category mappings
    const artisan = await this.databaseService.$transaction(async (tx) => {
      const created = await tx.artisan.create({
        data: {
          profileId: dto.profileId,
          userId,
          bio: dto.bio || null,
          customCategory: dto.customCategory || null,
          workingHours: dto.workingHours
            ? (dto.workingHours as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          status,
        },
      });

      // Create category mappings
      if (dto.categoryIds.length > 0) {
        const categoryMappings = dto.categoryIds.map((catId, index) => ({
          artisanId: created.id,
          categoryId: catId,
          isPrimary: index === 0,
        }));
        await tx.artisanCategoryMap.createMany({ data: categoryMappings });
      }

      // Create services
      if (dto.services && dto.services.length > 0) {
        const serviceData = dto.services.map((svc, index) => ({
          artisanId: created.id,
          name: svc.name,
          description: svc.description || null,
          price: svc.price != null ? new Prisma.Decimal(svc.price) : null,
          currency: svc.currency || 'NGN',
          duration: svc.duration || null,
          order: index,
        }));
        await tx.artisanService.createMany({ data: serviceData });
      }

      return created;
    });

    // Best-effort wallet KYC check — never block registration on wallet-nest
    try {
      const kyc = await this.walletClient.getUserWalletKycInfo(userId, token);
      if (kyc.canReceive) {
        await this.databaseService.artisan.update({
          where: { id: artisan.id },
          data: { canReceiveWalletPayments: true },
        });
      }
    } catch {
      // leave canReceiveWalletPayments at its default (false)
    }

    // Return full artisan profile
    return this.getArtisanResponse(artisan.id);
  }

  // ─── Self-management ────────────────────────────────────

  async getMyArtisan(userId: string, profileId: string) {
    if (!userId || !profileId) {
      throw new BadRequestException('User ID and Profile ID are required');
    }

    try {
      const artisan = await this.databaseService.artisan.findFirst({
        where: {
          OR: [
            { userId, profileId },
            { profile: { id: profileId, userId } },
          ],
        },
        include: this.fullArtisanInclude(),
      });

      if (!artisan) {
        throw new NotFoundException('Artisan profile not found');
      }

      return { success: true, data: artisan };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(
        `Failed to retrieve artisan profile for userId: "${userId}", profileId: "${profileId}": ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async updateArtisan(userId: string, dto: UpdateArtisanDto) {
    const artisan = await this.findOwnArtisan(userId, dto.profileId);

    const updated = await this.databaseService.artisan.update({
      where: { id: artisan.id },
      data: {
        bio: dto.bio !== undefined ? dto.bio : undefined,
        workingHours:
          dto.workingHours !== undefined
            ? (dto.workingHours as unknown as Prisma.InputJsonValue)
            : undefined,
        customCategory:
          dto.customCategory !== undefined ? dto.customCategory : undefined,
      },
      include: this.fullArtisanInclude(),
    });

    return { success: true, message: 'Artisan profile updated', data: updated };
  }

  async deactivate(userId: string, profileId: string) {
    const artisan = await this.findOwnArtisan(userId, profileId);

    if (artisan.status === 'DEACTIVATED') {
      throw new BadRequestException('Artisan is already deactivated');
    }

    await this.databaseService.artisan.update({
      where: { id: artisan.id },
      data: { status: 'DEACTIVATED' },
    });

    return {
      success: true,
      message: 'Artisan profile deactivated',
    };
  }

  async reactivate(userId: string, profileId: string) {
    const artisan = await this.findOwnArtisan(userId, profileId);

    if (artisan.status !== 'DEACTIVATED') {
      throw new BadRequestException(
        'Only deactivated artisans can be reactivated',
      );
    }

    const settings = await this.getOrCreateSettings();
    const newStatus = settings.artisanAutoApproval
      ? 'ACTIVE'
      : 'PENDING_REVIEW';

    await this.databaseService.artisan.update({
      where: { id: artisan.id },
      data: { status: newStatus },
    });

    return {
      success: true,
      message:
        newStatus === 'ACTIVE'
          ? 'Artisan profile reactivated'
          : 'Artisan profile submitted for review',
    };
  }

  // ─── Services CRUD ──────────────────────────────────────

  async getServices(userId: string, profileId: string) {
    const artisan = await this.findOwnArtisan(userId, profileId);

    const services = await this.databaseService.artisanService.findMany({
      where: { artisanId: artisan.id },
      orderBy: { order: 'asc' },
    });

    return { success: true, data: services };
  }

  async createService(
    userId: string,
    profileId: string,
    dto: CreateServiceDto,
  ) {
    const artisan = await this.findOwnArtisan(userId, profileId);

    const count = await this.databaseService.artisanService.count({
      where: { artisanId: artisan.id },
    });

    const service = await this.databaseService.artisanService.create({
      data: {
        artisanId: artisan.id,
        name: dto.name,
        description: dto.description || null,
        price: dto.price != null ? new Prisma.Decimal(dto.price) : null,
        currency: dto.currency || 'NGN',
        duration: dto.duration || null,
        order: count,
      },
    });

    return { success: true, message: 'Service created', data: service };
  }

  async updateService(
    userId: string,
    profileId: string,
    serviceId: string,
    dto: UpdateServiceDto,
  ) {
    const artisan = await this.findOwnArtisan(userId, profileId);

    const service = await this.databaseService.artisanService.findFirst({
      where: { id: serviceId, artisanId: artisan.id },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const updated = await this.databaseService.artisanService.update({
      where: { id: serviceId },
      data: {
        name: dto.name,
        description: dto.description,
        price:
          dto.price !== undefined ? new Prisma.Decimal(dto.price) : undefined,
        currency: dto.currency,
        duration: dto.duration,
        isActive: dto.isActive,
        order: dto.order,
      },
    });

    return { success: true, message: 'Service updated', data: updated };
  }

  async deleteService(userId: string, profileId: string, serviceId: string) {
    const artisan = await this.findOwnArtisan(userId, profileId);

    const service = await this.databaseService.artisanService.findFirst({
      where: { id: serviceId, artisanId: artisan.id },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    await this.databaseService.artisanService.delete({
      where: { id: serviceId },
    });

    return { success: true, message: 'Service deleted' };
  }

  // ─── Portfolio CRUD ─────────────────────────────────────

  async getPortfolio(userId: string, profileId: string) {
    const artisan = await this.findOwnArtisan(userId, profileId);

    const items = await this.databaseService.portfolioItem.findMany({
      where: { artisanId: artisan.id },
      orderBy: { order: 'asc' },
    });

    return { success: true, data: items };
  }

  async addPortfolioItem(
    userId: string,
    profileId: string,
    dto: AddPortfolioItemDto,
  ) {
    const artisan = await this.findOwnArtisan(userId, profileId);

    const count = await this.databaseService.portfolioItem.count({
      where: { artisanId: artisan.id },
    });

    const item = await this.databaseService.portfolioItem.create({
      data: {
        artisanId: artisan.id,
        type: dto.type || 'image',
        url: dto.url,
        thumbnail: dto.thumbnail || null,
        caption: dto.caption || null,
        order: dto.order ?? count,
      },
    });

    return { success: true, message: 'Portfolio item added', data: item };
  }

  async updatePortfolioItem(
    userId: string,
    profileId: string,
    itemId: string,
    dto: UpdatePortfolioItemDto,
  ) {
    const artisan = await this.findOwnArtisan(userId, profileId);

    const item = await this.databaseService.portfolioItem.findFirst({
      where: { id: itemId, artisanId: artisan.id },
    });
    if (!item) {
      throw new NotFoundException('Portfolio item not found');
    }

    const updated = await this.databaseService.portfolioItem.update({
      where: { id: itemId },
      data: {
        caption: dto.caption,
        order: dto.order,
      },
    });

    return {
      success: true,
      message: 'Portfolio item updated',
      data: updated,
    };
  }

  async deletePortfolioItem(userId: string, profileId: string, itemId: string) {
    const artisan = await this.findOwnArtisan(userId, profileId);

    const item = await this.databaseService.portfolioItem.findFirst({
      where: { id: itemId, artisanId: artisan.id },
    });
    if (!item) {
      throw new NotFoundException('Portfolio item not found');
    }

    await this.databaseService.portfolioItem.delete({
      where: { id: itemId },
    });

    return { success: true, message: 'Portfolio item deleted' };
  }

  // ─── Categories ─────────────────────────────────────────

  async updateCategories(userId: string, dto: UpdateCategoriesDto) {
    const artisan = await this.findOwnArtisan(userId, dto.profileId);

    // Enforce subscription plan limit for service categories
    const limits = await this.subscriptionsService.getUserLimits(userId);
    if (limits.serviceCategories === 0) {
      throw new PlanLimitException('serviceCategories', PlanTier.PRO_LITE);
    }
    if (dto.categoryIds.length > limits.serviceCategories) {
      throw new PlanLimitException('serviceCategories', PlanTier.PRO_PLUS);
    }

    const settings = await this.getOrCreateSettings();
    if (dto.categoryIds.length > settings.maxCategories) {
      throw new BadRequestException(
        `Maximum ${settings.maxCategories} categories allowed`,
      );
    }

    const categories = await this.databaseService.artisanCategory.findMany({
      where: { id: { in: dto.categoryIds }, isActive: true },
    });
    if (categories.length !== dto.categoryIds.length) {
      throw new BadRequestException('One or more categories are invalid');
    }

    await this.databaseService.$transaction(async (tx) => {
      // Remove old mappings
      await tx.artisanCategoryMap.deleteMany({
        where: { artisanId: artisan.id },
      });

      // Create new mappings
      const mappings = dto.categoryIds.map((catId, index) => ({
        artisanId: artisan.id,
        categoryId: catId,
        isPrimary: index === 0,
      }));
      await tx.artisanCategoryMap.createMany({ data: mappings });
    });

    return { success: true, message: 'Categories updated' };
  }

  async getAllCategories() {
    const categories = await this.databaseService.artisanCategory.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });

    return { success: true, data: categories };
  }

  // ─── Bookings — Artisan side ────────────────────────────

  async getArtisanBookings(
    userId: string,
    profileId: string,
    status?: string,
    page = 1,
    limit = 20,
  ) {
    const artisan = await this.findOwnArtisan(userId, profileId);
    const skip = (page - 1) * limit;

    const where: any = { artisanId: artisan.id };
    if (status) {
      where.status = status;
    }

    const [bookings, total] = await Promise.all([
      this.databaseService.booking.findMany({
        where,
        include: {
          service: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.databaseService.booking.count({ where }),
    ]);

    return {
      success: true,
      data: bookings,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async confirmBooking(userId: string, profileId: string, bookingId: string) {
    const artisan = await this.findOwnArtisan(userId, profileId);

    const booking = await this.databaseService.booking.findFirst({
      where: { id: bookingId, artisanId: artisan.id, status: 'PENDING' },
    });
    if (!booking) {
      throw new NotFoundException('Pending booking not found');
    }

    const updated = await this.databaseService.booking.update({
      where: { id: bookingId },
      data: { status: 'CONFIRMED' },
    });

    return { success: true, message: 'Booking confirmed', data: updated };
  }

  /**
   * Get a single booking by ID. Accessible by the artisan who owns it
   * or the customer who made it.
   */
  async getBookingById(userId: string, bookingId: string) {
    const booking = await this.databaseService.booking.findFirst({
      where: { id: bookingId },
      include: {
        service: true,
        artisan: {
          include: {
            profile: {
              select: {
                id: true,
                name: true,
                slug: true,
                profilePhoto: true,
              },
            },
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Verify the user is a participant
    const isCustomer = booking.customerUserId === userId;
    const isArtisan = booking.artisan?.userId === userId;

    if (!isCustomer && !isArtisan) {
      throw new ForbiddenException('You are not a participant of this booking');
    }

    // Find associated thread if any
    const thread = await this.databaseService.bookingThread.findFirst({
      where: { bookingId: booking.id },
      select: { id: true, status: true },
    });

    return {
      success: true,
      data: {
        ...booking,
        thread: thread || null,
        viewerRole: isCustomer ? 'CLIENT' : 'ARTISAN',
      },
    };
  }

  async startBooking(userId: string, profileId: string, bookingId: string) {
    const artisan = await this.findOwnArtisan(userId, profileId);

    const booking = await this.databaseService.booking.findFirst({
      where: { id: bookingId, artisanId: artisan.id, status: 'CONFIRMED' },
    });
    if (!booking) {
      throw new NotFoundException('Confirmed booking not found');
    }

    const updated = await this.databaseService.booking.update({
      where: { id: bookingId },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });

    return { success: true, message: 'Booking started', data: updated };
  }

  async completeBooking(userId: string, profileId: string, bookingId: string) {
    const artisan = await this.findOwnArtisan(userId, profileId);

    const booking = await this.databaseService.booking.findFirst({
      where: { id: bookingId, artisanId: artisan.id, status: 'IN_PROGRESS' },
    });
    if (!booking) {
      throw new NotFoundException('In-progress booking not found');
    }

    const updated = await this.databaseService.$transaction(async (tx) => {
      const result = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // Increment total bookings counter
      await tx.artisan.update({
        where: { id: artisan.id },
        data: { totalBookings: { increment: 1 } },
      });

      return result;
    });

    return { success: true, message: 'Booking completed', data: updated };
  }

  async cancelBookingAsArtisan(
    userId: string,
    profileId: string,
    bookingId: string,
    dto: CancelBookingDto,
  ) {
    const artisan = await this.findOwnArtisan(userId, profileId);

    const booking = await this.databaseService.booking.findFirst({
      where: {
        id: bookingId,
        artisanId: artisan.id,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found or cannot be cancelled');
    }

    const updated = await this.databaseService.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELLED',
        cancelledBy: 'artisan',
        cancellationReason: dto.reason || null,
        cancelledAt: new Date(),
      },
    });

    return { success: true, message: 'Booking cancelled', data: updated };
  }

  // ─── Bookings — Customer side ───────────────────────────

  async createBooking(
    userId: string,
    customerProfileId: string,
    artisanId: string,
    dto: CreateBookingDto,
  ) {
    // Verify the artisan exists and is ACTIVE
    const artisan = await this.databaseService.artisan.findFirst({
      where: { id: artisanId, status: 'ACTIVE' },
    });
    if (!artisan) {
      throw new NotFoundException('Artisan not found or not active');
    }

    // Verify customer profile belongs to user
    const customerProfile = await this.databaseService.profile.findFirst({
      where: { id: customerProfileId, userId },
    });
    if (!customerProfile) {
      throw new NotFoundException('Customer profile not found');
    }

    // Validate service if provided
    let service = null;
    if (dto.serviceId) {
      service = await this.databaseService.artisanService.findFirst({
        where: { id: dto.serviceId, artisanId, isActive: true },
      });
      if (!service) {
        throw new NotFoundException('Service not found or not active');
      }
    }

    const booking = await this.databaseService.booking.create({
      data: {
        artisanId,
        serviceId: dto.serviceId || null,
        customerProfileId,
        customerUserId: userId,
        scheduledDate: new Date(dto.scheduledDate),
        scheduledTime: dto.scheduledTime || null,
        duration: dto.duration || service?.duration || null,
        agreedPrice: dto.agreedPrice
          ? new Prisma.Decimal(dto.agreedPrice)
          : service
            ? service.price
            : null,
        currency: service?.currency || 'NGN',
        note: dto.note || null,
        customerName: dto.customerName || null,
        customerPhone: dto.customerPhone || null,
      },
      include: {
        artisan: {
          include: {
            profile: {
              select: { id: true, name: true, profilePhoto: true, slug: true },
            },
          },
        },
        service: true,
      },
    });

    return { success: true, message: 'Booking created', data: booking };
  }

  async getMyBookings(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      this.databaseService.booking.findMany({
        where: { customerUserId: userId },
        include: {
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
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.databaseService.booking.count({ where: { customerUserId: userId } }),
    ]);

    return {
      success: true,
      data: bookings,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async cancelBookingAsCustomer(
    userId: string,
    bookingId: string,
    dto: CancelBookingDto,
  ) {
    const booking = await this.databaseService.booking.findFirst({
      where: {
        id: bookingId,
        customerUserId: userId,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found or cannot be cancelled');
    }

    const updated = await this.databaseService.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELLED',
        cancelledBy: 'customer',
        cancellationReason: dto.reason || null,
        cancelledAt: new Date(),
      },
    });

    return { success: true, message: 'Booking cancelled', data: updated };
  }

  // ─── Reviews ────────────────────────────────────────────

  async createReview(
    userId: string,
    artisanId: string,
    dto: CreateReviewDto,
    token: string,
  ) {
    // Verify artisan exists
    const artisan = await this.databaseService.artisan.findUnique({
      where: { id: artisanId },
    });
    if (!artisan) {
      throw new NotFoundException('Artisan not found');
    }

    // If bookingId provided, verify booking eligibility
    if (dto.bookingId) {
      const booking = await this.databaseService.booking.findFirst({
        where: {
          id: dto.bookingId,
          artisanId,
          customerUserId: userId,
          status: 'COMPLETED',
        },
      });
      if (!booking) {
        throw new BadRequestException(
          'Booking not found, not completed, or not yours',
        );
      }

      // Check no existing review for this booking
      const existingReview = await this.databaseService.review.findUnique({
        where: { bookingId: dto.bookingId },
      });
      if (existingReview) {
        throw new ConflictException('This booking has already been reviewed');
      }
    } else {
      // No bookingId: only allow if the reviewer has an executed wallet
      // payment to this artisan (closes the "anyone can review anyone" gap).
      const eligible = await this.walletClient.hasCompletedArtisanPayment(
        userId,
        artisan.userId,
        token,
      );
      if (!eligible) {
        throw new BadRequestException(
          'You can only review artisans you have booked and paid',
        );
      }
    }

    // Create review and recalculate stats
    const review = await this.databaseService.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          artisanId,
          reviewerUserId: userId,
          bookingId: dto.bookingId || null,
          rating: dto.rating,
          comment: dto.comment || null,
          paymentReference: dto.paymentReference || null,
        },
      });

      // Recalculate average rating
      const stats = await tx.review.aggregate({
        where: { artisanId, isVisible: true },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await tx.artisan.update({
        where: { id: artisanId },
        data: {
          averageRating: stats._avg.rating
            ? new Prisma.Decimal(stats._avg.rating.toFixed(2))
            : new Prisma.Decimal(0),
          totalReviews: stats._count.rating,
        },
      });

      return created;
    });

    // Notification: review received by artisan
    if (artisan.userId) {
      this.notifications
        .dispatch({
          userId: artisan.userId,
          profileId: artisan.profileId,
          type: 'REVIEW_RECEIVED',
          title: 'New Review Received',
          message: `You received a ${dto.rating}-star review${dto.comment ? `: "${dto.comment.slice(0, 60)}"` : ''}`,
          actionUrl: `/connect/artisan/reviews`,
          actionLabel: 'View Reviews',
        })
        .catch(() => {});

      const webUrl = process.env.CONNECT_WEB_URL ?? '';
      const stars = '★'.repeat(dto.rating) + '☆'.repeat(5 - dto.rating);
      this.authClient
        .getUserEmail(artisan.userId)
        .then((email) => {
          if (!email) return;
          this.mail
            .sendEmail({
              to: email,
              subject: 'New Review Received',
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="margin-top:0">New Review Received</h2>
  <p>You received a <strong>${dto.rating}-star</strong> review ${stars}</p>
  ${dto.comment ? `<blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#555;font-style:italic">&ldquo;${dto.comment}&rdquo;</blockquote>` : ''}
  <a href="${webUrl}/connect/artisan/reviews" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:6px">View Reviews</a>
</div>`,
            })
            .catch(() => {});
        })
        .catch(() => {});
    }

    return { success: true, message: 'Review submitted', data: review };
  }

  async getArtisanReviews(artisanId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.databaseService.review.findMany({
        where: { artisanId, isVisible: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.databaseService.review.count({
        where: { artisanId, isVisible: true },
      }),
    ]);

    // Enrich reviews with reviewer profile info (name + photo)
    const reviewerIds = [
      ...new Set(reviews.map((r) => r.reviewerUserId).filter(Boolean)),
    ];
    const profiles =
      reviewerIds.length > 0
        ? await this.databaseService.profile.findMany({
            where: { id: { in: reviewerIds } },
            select: { id: true, name: true, profilePhoto: true },
          })
        : [];
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    const enrichedReviews = reviews.map((r) => {
      const profile = profileMap.get(r.reviewerUserId);
      return {
        ...r,
        reviewer: profile
          ? { name: profile.name, profilePhoto: profile.profilePhoto ?? null }
          : null,
      };
    });

    return {
      success: true,
      data: enrichedReviews,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Earnings & Analytics ───────────────────────────────

  async getEarnings(userId: string, profileId: string) {
    const artisan = await this.findOwnArtisan(userId, profileId);

    const completedBookings = await this.databaseService.booking.findMany({
      where: { artisanId: artisan.id, status: 'COMPLETED', isPaid: true },
      select: {
        agreedPrice: true,
        commissionAmount: true,
        completedAt: true,
      },
      orderBy: { completedAt: 'desc' },
    });

    return {
      success: true,
      data: {
        totalEarnings: artisan.totalEarnings,
        totalBookings: artisan.totalBookings,
        averageRating: artisan.averageRating,
        totalReviews: artisan.totalReviews,
        recentTransactions: completedBookings.slice(0, 10),
      },
    };
  }

  // ─── Directory — public listing ─────────────────────────

  async directoryListing(query: {
    page?: number;
    limit?: number;
    category?: string;
    location?: string;
    search?: string;
    minRating?: number;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { status: 'ACTIVE' };

    // Filter by category slug
    if (query.category) {
      where.categories = {
        some: {
          category: { slug: query.category },
        },
      };
    }

    // Full-text search on bio
    if (query.search) {
      where.OR = [
        { bio: { contains: query.search, mode: 'insensitive' } },
        {
          profile: {
            name: { contains: query.search, mode: 'insensitive' },
          },
        },
        {
          services: {
            some: { name: { contains: query.search, mode: 'insensitive' } },
          },
        },
      ];
    }

    // Location search
    if (query.location) {
      where.profile = {
        ...where.profile,
        location: { contains: query.location, mode: 'insensitive' },
      };
    }

    // Minimum rating
    if (query.minRating) {
      where.averageRating = { gte: new Prisma.Decimal(query.minRating) };
    }

    // Sort
    let orderBy: any;
    const direction = query.sortOrder === 'asc' ? 'asc' : 'desc';
    switch (query.sortBy) {
      case 'newest':
        orderBy = { createdAt: direction };
        break;
      case 'bookings':
        orderBy = { totalBookings: direction };
        break;
      case 'name':
        orderBy = { profile: { name: direction } };
        break;
      case 'rating':
      default:
        orderBy = { averageRating: direction };
        break;
    }

    const [artisans, total] = await Promise.all([
      this.databaseService.artisan.findMany({
        where,
        include: {
          profile: {
            select: {
              id: true,
              name: true,
              profilePhoto: true,
              slug: true,
              location: true,
            },
          },
          categories: {
            include: { category: true },
            orderBy: { isPrimary: 'desc' },
          },
          services: {
            where: { isActive: true },
            orderBy: { order: 'asc' },
            take: 3,
          },
          portfolio: {
            orderBy: { order: 'asc' },
            take: 3,
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.databaseService.artisan.count({ where }),
    ]);

    return {
      success: true,
      data: {
        artisans,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getArtisanPublicProfile(artisanId: string) {
    const artisan = await this.databaseService.artisan.findFirst({
      where: { id: artisanId, status: 'ACTIVE' },
      include: this.fullArtisanInclude(),
    });

    if (!artisan) {
      throw new NotFoundException('Artisan not found');
    }

    return { success: true, data: artisan };
  }

  async getFeaturedArtisans(limit = 10) {
    // Sponsored first, then by rating
    const artisans = await this.databaseService.artisan.findMany({
      where: { status: 'ACTIVE' },
      include: {
        profile: {
          select: {
            id: true,
            name: true,
            profilePhoto: true,
            slug: true,
            location: true,
          },
        },
        categories: {
          include: { category: true },
          where: { isPrimary: true },
        },
      },
      orderBy: [{ averageRating: 'desc' }, { totalBookings: 'desc' }],
      take: limit,
    });

    return { success: true, data: artisans };
  }

  async getCategoriesWithCounts() {
    const categories = await this.databaseService.artisanCategory.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            artisans: {
              where: { artisan: { status: 'ACTIVE' } },
            },
          },
        },
      },
      orderBy: { order: 'asc' },
    });

    return { success: true, data: categories };
  }

  // ─── Admin Operations ───────────────────────────────────

  async adminListArtisans(status?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;

    const [artisans, total] = await Promise.all([
      this.databaseService.artisan.findMany({
        where,
        include: {
          profile: {
            select: {
              id: true,
              name: true,
              profilePhoto: true,
              slug: true,
            },
          },
          categories: { include: { category: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.databaseService.artisan.count({ where }),
    ]);

    return {
      success: true,
      data: artisans,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async approveArtisan(artisanId: string) {
    const artisan = await this.databaseService.artisan.findUnique({
      where: { id: artisanId },
    });
    if (!artisan) {
      throw new NotFoundException('Artisan not found');
    }
    if (artisan.status !== 'PENDING_REVIEW') {
      throw new BadRequestException('Artisan is not pending review');
    }

    const updated = await this.databaseService.artisan.update({
      where: { id: artisanId },
      data: { status: 'ACTIVE' },
    });

    // Notification: artisan activated
    if (artisan.userId) {
      this.notifications
        .dispatch({
          userId: artisan.userId,
          profileId: artisan.profileId,
          type: 'ARTISAN_ACTIVATED',
          title: 'Artisan Profile Approved',
          message: 'Your artisan profile has been approved and is now active!',
          actionUrl: `/connect/artisan`,
          actionLabel: 'View Profile',
        })
        .catch(() => {});

      const webUrl = process.env.CONNECT_WEB_URL ?? '';
      this.authClient
        .getUserEmail(artisan.userId)
        .then((email) => {
          if (!email) return;
          this.mail
            .sendEmail({
              to: email,
              subject: 'Your Artisan Profile Has Been Approved!',
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="margin-top:0">Artisan Profile Approved 🎉</h2>
  <p>Congratulations! Your artisan profile has been reviewed and approved. You are now live on ISCE Connect and can start receiving bookings.</p>
  <a href="${webUrl}/connect/artisan" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:6px">View Your Profile</a>
</div>`,
            })
            .catch(() => {});
        })
        .catch(() => {});
    }

    return { success: true, message: 'Artisan approved', data: updated };
  }

  async suspendArtisan(artisanId: string, reason: string) {
    const artisan = await this.databaseService.artisan.findUnique({
      where: { id: artisanId },
    });
    if (!artisan) {
      throw new NotFoundException('Artisan not found');
    }

    const updated = await this.databaseService.artisan.update({
      where: { id: artisanId },
      data: { status: 'SUSPENDED', suspendedReason: reason },
    });

    // Notification: artisan suspended
    if (artisan.userId) {
      this.notifications
        .dispatch({
          userId: artisan.userId,
          profileId: artisan.profileId,
          type: 'ARTISAN_SUSPENDED',
          title: 'Artisan Profile Suspended',
          message: `Your artisan profile has been suspended. Reason: ${reason}`,
          actionUrl: `/connect/artisan`,
          actionLabel: 'View Details',
        })
        .catch(() => {});

      const webUrl = process.env.CONNECT_WEB_URL ?? '';
      this.authClient
        .getUserEmail(artisan.userId)
        .then((email) => {
          if (!email) return;
          this.mail
            .sendEmail({
              to: email,
              subject: 'Your Artisan Profile Has Been Suspended',
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="margin-top:0">Artisan Profile Suspended</h2>
  <p>Your artisan profile has been suspended for the following reason:</p>
  <blockquote style="border-left:3px solid #e53e3e;padding-left:12px;color:#555">${reason}</blockquote>
  <p>If you believe this is a mistake, please contact our support team.</p>
  <a href="${webUrl}/connect/artisan" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:6px">View Details</a>
</div>`,
            })
            .catch(() => {});
        })
        .catch(() => {});
    }

    return { success: true, message: 'Artisan suspended', data: updated };
  }

  async unsuspendArtisan(artisanId: string) {
    const artisan = await this.databaseService.artisan.findUnique({
      where: { id: artisanId },
    });
    if (!artisan) {
      throw new NotFoundException('Artisan not found');
    }
    if (artisan.status !== 'SUSPENDED') {
      throw new BadRequestException('Artisan is not suspended');
    }

    const updated = await this.databaseService.artisan.update({
      where: { id: artisanId },
      data: { status: 'ACTIVE', suspendedReason: null },
    });

    // Notification: artisan reactivated
    if (artisan.userId) {
      this.notifications
        .dispatch({
          userId: artisan.userId,
          profileId: artisan.profileId,
          type: 'ARTISAN_ACTIVATED',
          title: 'Artisan Profile Reactivated',
          message:
            'Your artisan profile has been reactivated and is now active again!',
          actionUrl: `/connect/artisan`,
          actionLabel: 'View Profile',
        })
        .catch(() => {});

      const webUrl = process.env.CONNECT_WEB_URL ?? '';
      this.authClient
        .getUserEmail(artisan.userId)
        .then((email) => {
          if (!email) return;
          this.mail
            .sendEmail({
              to: email,
              subject: 'Your Artisan Profile Has Been Reactivated',
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="margin-top:0">Artisan Profile Reactivated</h2>
  <p>Good news! Your artisan profile has been reactivated and is now live on ISCE Connect again.</p>
  <a href="${webUrl}/connect/artisan" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:6px">View Your Profile</a>
</div>`,
            })
            .catch(() => {});
        })
        .catch(() => {});
    }

    return { success: true, message: 'Artisan unsuspended', data: updated };
  }

  async adminToggleReviewVisibility(reviewId: string) {
    const review = await this.databaseService.review.findUnique({
      where: { id: reviewId },
    });
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const updated = await this.databaseService.review.update({
      where: { id: reviewId },
      data: { isVisible: !review.isVisible },
    });

    // Recalculate stats
    const stats = await this.databaseService.review.aggregate({
      where: { artisanId: review.artisanId, isVisible: true },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await this.databaseService.artisan.update({
      where: { id: review.artisanId },
      data: {
        averageRating: stats._avg.rating
          ? new Prisma.Decimal(stats._avg.rating.toFixed(2))
          : new Prisma.Decimal(0),
        totalReviews: stats._count.rating,
      },
    });

    return {
      success: true,
      message: `Review ${updated.isVisible ? 'shown' : 'hidden'}`,
      data: updated,
    };
  }

  // ─── Platform Settings ──────────────────────────────────

  async getSettings() {
    const settings = await this.getOrCreateSettings();
    return { success: true, data: settings };
  }

  async updateSettings(data: Record<string, any>, actorId: string = 'unknown') {
    const settings = await this.getOrCreateSettings();

    const updated = await this.databaseService.platformSetting.update({
      where: { id: settings.id },
      data,
    });

    // Write an audit-log entry so every PlatformSetting change is traceable.
    // Fire-and-forget — a logging failure must never break the settings update.
    void this.databaseService.cpAuditLog
      .create({
        data: {
          actorId,
          actorRole: 'SUPER_ADMIN',
          isSystemEvent: false,
          eventType: 'PLATFORM_SETTINGS_UPDATED',
          targetEntity: 'PlatformSetting',
          targetEntityId: settings.id,
          action: 'UPDATE',
          before: settings as unknown as Prisma.InputJsonValue,
          after: updated as unknown as Prisma.InputJsonValue,
          source: CpAuditSource.API,
          success: true,
        },
      })
      .catch((err) =>
        console.error('[ArtisanService] Failed to write audit log for PlatformSetting update:', err),
      );

    return { success: true, message: 'Settings updated', data: updated };
  }


  // ─── Admin Category CRUD ───────────────────────────────

  async adminCreateCategory(data: {
    name: string;
    slug: string;
    icon?: string;
    description?: string;
    order?: number;
  }) {
    const existing = await this.databaseService.artisanCategory.findFirst({
      where: { OR: [{ name: data.name }, { slug: data.slug }] },
    });
    if (existing) {
      throw new ConflictException('Category name or slug already exists');
    }

    const category = await this.databaseService.artisanCategory.create({
      data: {
        name: data.name,
        slug: data.slug,
        icon: data.icon || null,
        description: data.description || null,
        order: data.order || 0,
      },
    });

    return { success: true, message: 'Category created', data: category };
  }

  async adminUpdateCategory(
    categoryId: string,
    data: {
      name?: string;
      icon?: string;
      description?: string;
      order?: number;
      isActive?: boolean;
    },
  ) {
    const category = await this.databaseService.artisanCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const updated = await this.databaseService.artisanCategory.update({
      where: { id: categoryId },
      data,
    });

    return { success: true, message: 'Category updated', data: updated };
  }

  async adminDeleteCategory(categoryId: string) {
    const category = await this.databaseService.artisanCategory.findUnique({
      where: { id: categoryId },
      include: { _count: { select: { artisans: true } } },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    if (category._count.artisans > 0) {
      throw new BadRequestException(
        'Cannot delete category with active artisans. Deactivate it instead.',
      );
    }

    await this.databaseService.artisanCategory.delete({
      where: { id: categoryId },
    });

    return { success: true, message: 'Category deleted' };
  }

  // ─── Promotions ─────────────────────────────────────────

  async createPromotion(
    userId: string,
    profileId: string,
    type: 'SPONSORED' | 'BOOST',
    durationDays: number,
  ) {
    const artisan = await this.findOwnArtisan(userId, profileId);

    if (artisan.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Only active artisans can create promotions',
      );
    }

    const settings = await this.getOrCreateSettings();
    const dailyRate =
      type === 'SPONSORED'
        ? Number(settings.sponsoredPriceDaily)
        : Number(settings.boostPriceDaily);
    const amount = dailyRate * durationDays;

    const startsAt = new Date();
    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + durationDays);

    const promotion = await this.databaseService.promotion.create({
      data: {
        artisanId: artisan.id,
        type,
        amount: new Prisma.Decimal(amount),
        startsAt,
        endsAt,
        status: 'ACTIVE',
      },
    });

    return {
      success: true,
      message: 'Promotion created',
      data: { ...promotion, totalCost: amount },
    };
  }

  async getMyPromotions(userId: string, profileId: string) {
    const artisan = await this.findOwnArtisan(userId, profileId);

    const promotions = await this.databaseService.promotion.findMany({
      where: { artisanId: artisan.id },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: promotions };
  }

  async cancelPromotion(
    userId: string,
    profileId: string,
    promotionId: string,
  ) {
    const artisan = await this.findOwnArtisan(userId, profileId);

    const promotion = await this.databaseService.promotion.findFirst({
      where: { id: promotionId, artisanId: artisan.id, status: 'ACTIVE' },
    });
    if (!promotion) {
      throw new NotFoundException('Active promotion not found');
    }

    const updated = await this.databaseService.promotion.update({
      where: { id: promotionId },
      data: { status: 'CANCELLED' },
    });

    return { success: true, message: 'Promotion cancelled', data: updated };
  }

  // ─── Helpers ────────────────────────────────────────────

  private async findOwnArtisan(userId: string, profileId: string) {
    if (!userId || !profileId) {
      throw new BadRequestException('User ID and Profile ID are required');
    }

    const artisan = await this.databaseService.artisan.findFirst({
      where: {
        OR: [
          { userId, profileId },
          { profile: { id: profileId, userId } },
        ],
      },
    });
    if (!artisan) {
      throw new NotFoundException('Artisan profile not found');
    }
    return artisan;
  }

  private async getArtisanResponse(artisanId: string) {
    const artisan = await this.databaseService.artisan.findUnique({
      where: { id: artisanId },
      include: this.fullArtisanInclude(),
    });

    return {
      success: true,
      message: 'Artisan registered successfully',
      data: artisan,
    };
  }

  private fullArtisanInclude() {
    return {
      profile: {
        select: {
          id: true,
          name: true,
          profilePhoto: true,
          slug: true,
          location: true,
          description: true,
          position: true,
        },
      },
      categories: {
        include: { category: true },
        orderBy: { isPrimary: 'desc' as const },
      },
      services: {
        where: { isActive: true },
        orderBy: { order: 'asc' as const },
      },
      portfolio: {
        orderBy: { order: 'asc' as const },
      },
    };
  }

  private async getOrCreateSettings() {
    let settings = await this.databaseService.platformSetting.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await this.databaseService.platformSetting.create({
        data: { id: 'default' },
      });
    }

    return settings;
  }
}
