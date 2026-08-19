import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { ArtisanService } from './artisan.service';
import { PublicRoute } from '../auth/decorators/public-route.decorator';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
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
  CreatePromotionDto,
  DirectoryQueryDto,
  SuspendArtisanDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  UpdatePlatformSettingsDto,
} from './dto/artisan.dto';

// ═══════════════════════════════════════════════════════════
// Artisan Controller — authenticated artisan operations
// ═══════════════════════════════════════════════════════════

@ApiTags('Artisan')
@ApiBearerAuth('access-token')
@Controller('artisan')
export class ArtisanController {
  constructor(private readonly artisanService: ArtisanService) {}

  // ─── Registration ─────────────────────────────────────

  @Get('requirements')
  @ApiOperation({ summary: 'Get artisan registration requirements' })
  @ApiResponse({ status: 200, description: 'Requirements returned' })
  async getRequirements() {
    return this.artisanService.getRequirements();
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a profile as an artisan' })
  @ApiResponse({ status: 201, description: 'Artisan registered' })
  @ApiResponse({ status: 409, description: 'Already registered' })
  async register(
    @Request() req,
    @Body(ValidationPipe) dto: RegisterArtisanDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.artisanService.register(user.id, dto, req.headers.authorization);
  }

  // ─── Self-management ──────────────────────────────────

  @Get('me/:profileId')
  @ApiOperation({ summary: 'Get own artisan profile' })
  @ApiResponse({ status: 200, description: 'Artisan profile returned' })
  async getMyArtisan(@Request() req, @Param('profileId') profileId: string) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.artisanService.getMyArtisan(user.id, profileId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own artisan profile' })
  @ApiResponse({ status: 200, description: 'Artisan updated' })
  async updateArtisan(
    @Request() req,
    @Body(ValidationPipe) dto: UpdateArtisanDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.artisanService.updateArtisan(user.id, dto);
  }

  @Post('me/:profileId/deactivate')
  @ApiOperation({ summary: 'Deactivate own artisan profile' })
  @ApiResponse({ status: 200, description: 'Artisan deactivated' })
  async deactivate(@Request() req, @Param('profileId') profileId: string) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.artisanService.deactivate(user.id, profileId);
  }

  @Post('me/:profileId/reactivate')
  @ApiOperation({ summary: 'Reactivate own artisan profile' })
  @ApiResponse({ status: 200, description: 'Artisan reactivated' })
  async reactivate(@Request() req, @Param('profileId') profileId: string) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.artisanService.reactivate(user.id, profileId);
  }

  // ─── Services CRUD ────────────────────────────────────

  @Get('services/:profileId')
  @ApiOperation({ summary: 'List own artisan services' })
  @ApiResponse({ status: 200, description: 'Services returned' })
  async getServices(@Request() req, @Param('profileId') profileId: string) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.artisanService.getServices(user.id, profileId);
  }

  @Post('services/:profileId')
  @ApiOperation({ summary: 'Add a new service' })
  @ApiResponse({ status: 201, description: 'Service created' })
  async createService(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: CreateServiceDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.artisanService.createService(user.id, profileId, dto);
  }

  @Patch('services/:profileId/:serviceId')
  @ApiOperation({ summary: 'Update a service' })
  @ApiResponse({ status: 200, description: 'Service updated' })
  async updateService(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('serviceId') serviceId: string,
    @Body(ValidationPipe) dto: UpdateServiceDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.artisanService.updateService(
      user.id,
      profileId,
      serviceId,
      dto,
    );
  }

  @Delete('services/:profileId/:serviceId')
  @ApiOperation({ summary: 'Delete a service' })
  @ApiResponse({ status: 200, description: 'Service deleted' })
  async deleteService(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('serviceId') serviceId: string,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.artisanService.deleteService(user.id, profileId, serviceId);
  }

  // ─── Portfolio CRUD ───────────────────────────────────

  @Get('portfolio/:profileId')
  @ApiOperation({ summary: 'List own portfolio items' })
  @ApiResponse({ status: 200, description: 'Portfolio returned' })
  async getPortfolio(@Request() req, @Param('profileId') profileId: string) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.artisanService.getPortfolio(user.id, profileId);
  }

  @Post('portfolio/:profileId')
  @ApiOperation({ summary: 'Add a portfolio item' })
  @ApiResponse({ status: 201, description: 'Portfolio item added' })
  async addPortfolioItem(
    @Request() req,
    @Param('profileId') profileId: string,
    @Body(ValidationPipe) dto: AddPortfolioItemDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.artisanService.addPortfolioItem(user.id, profileId, dto);
  }

  @Patch('portfolio/:profileId/:itemId')
  @ApiOperation({ summary: 'Update a portfolio item' })
  @ApiResponse({ status: 200, description: 'Portfolio item updated' })
  async updatePortfolioItem(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('itemId') itemId: string,
    @Body(ValidationPipe) dto: UpdatePortfolioItemDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.artisanService.updatePortfolioItem(
      user.id,
      profileId,
      itemId,
      dto,
    );
  }

  @Delete('portfolio/:profileId/:itemId')
  @ApiOperation({ summary: 'Delete a portfolio item' })
  @ApiResponse({ status: 200, description: 'Portfolio item deleted' })
  async deletePortfolioItem(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('itemId') itemId: string,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.artisanService.deletePortfolioItem(user.id, profileId, itemId);
  }

  // ─── Categories ───────────────────────────────────────

  @Patch('categories')
  @ApiOperation({ summary: 'Update own artisan categories' })
  @ApiResponse({ status: 200, description: 'Categories updated' })
  async updateCategories(
    @Request() req,
    @Body(ValidationPipe) dto: UpdateCategoriesDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.artisanService.updateCategories(user.id, dto);
  }

  // ─── Bookings — Artisan side ──────────────────────────

  @Get('bookings/:profileId')
  @ApiOperation({ summary: 'List bookings for own artisan profile' })
  @ApiResponse({ status: 200, description: 'Bookings returned' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getArtisanBookings(
    @Request() req,
    @Param('profileId') profileId: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.artisanService.getArtisanBookings(
      user.id,
      profileId,
      status,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get('bookings/detail/:bookingId')
  @ApiOperation({ summary: 'Get a single booking by ID' })
  @ApiResponse({ status: 200, description: 'Booking returned' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async getBookingById(@Request() req, @Param('bookingId') bookingId: string) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.artisanService.getBookingById(user.id, bookingId);
  }

  @Post('bookings/:profileId/:bookingId/confirm')
  @ApiOperation({ summary: 'Confirm a pending booking' })
  @ApiResponse({ status: 200, description: 'Booking confirmed' })
  async confirmBooking(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('bookingId') bookingId: string,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.artisanService.confirmBooking(user.id, profileId, bookingId);
  }

  @Post('bookings/:profileId/:bookingId/start')
  @ApiOperation({ summary: 'Start a confirmed booking' })
  @ApiResponse({ status: 200, description: 'Booking started' })
  async startBooking(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('bookingId') bookingId: string,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.artisanService.startBooking(user.id, profileId, bookingId);
  }

  @Post('bookings/:profileId/:bookingId/complete')
  @ApiOperation({ summary: 'Complete an in-progress booking' })
  @ApiResponse({ status: 200, description: 'Booking completed' })
  async completeBooking(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('bookingId') bookingId: string,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.artisanService.completeBooking(user.id, profileId, bookingId);
  }

  @Post('bookings/:profileId/:bookingId/cancel')
  @ApiOperation({ summary: 'Cancel a booking as artisan' })
  @ApiResponse({ status: 200, description: 'Booking cancelled' })
  async cancelBookingAsArtisan(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('bookingId') bookingId: string,
    @Body(ValidationPipe) dto: CancelBookingDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.artisanService.cancelBookingAsArtisan(
      user.id,
      profileId,
      bookingId,
      dto,
    );
  }

  // ─── Bookings — Customer side ─────────────────────────

  @Post(':artisanId/book')
  @ApiOperation({ summary: 'Create a booking as a customer' })
  @ApiResponse({ status: 201, description: 'Booking created' })
  @ApiQuery({
    name: 'profileId',
    required: true,
    description: 'Customer profile ID',
  })
  async createBooking(
    @Request() req,
    @Param('artisanId') artisanId: string,
    @Query('profileId') profileId: string,
    @Body(ValidationPipe) dto: CreateBookingDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.artisanService.createBooking(
      user.id,
      profileId,
      artisanId,
      dto,
    );
  }

  @Get('my-bookings')
  @ApiOperation({ summary: 'List own bookings as a customer' })
  @ApiResponse({ status: 200, description: 'Bookings returned' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getMyBookings(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.artisanService.getMyBookings(
      user.id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Post('my-bookings/:bookingId/cancel')
  @ApiOperation({ summary: 'Cancel a booking as customer' })
  @ApiResponse({ status: 200, description: 'Booking cancelled' })
  async cancelBookingAsCustomer(
    @Request() req,
    @Param('bookingId') bookingId: string,
    @Body(ValidationPipe) dto: CancelBookingDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.artisanService.cancelBookingAsCustomer(user.id, bookingId, dto);
  }

  // ─── Reviews ──────────────────────────────────────────

  @Post(':artisanId/reviews')
  @ApiOperation({ summary: 'Submit a review for an artisan' })
  @ApiResponse({ status: 201, description: 'Review submitted' })
  async createReview(
    @Request() req,
    @Param('artisanId') artisanId: string,
    @Body(ValidationPipe) dto: CreateReviewDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.artisanService.createReview(
      user.id,
      artisanId,
      dto,
      req.headers.authorization,
    );
  }

  // ─── Promotions ───────────────────────────────────────

  @Post('promotions')
  @ApiOperation({ summary: 'Create a promotion for artisan profile' })
  @ApiResponse({ status: 201, description: 'Promotion created' })
  async createPromotion(
    @Request() req,
    @Body(ValidationPipe) dto: CreatePromotionDto,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.artisanService.createPromotion(
      user.id,
      dto.profileId,
      dto.type,
      dto.durationDays,
    );
  }

  @Get('promotions/:profileId')
  @ApiOperation({ summary: 'List own promotions' })
  @ApiResponse({ status: 200, description: 'Promotions returned' })
  async getMyPromotions(@Request() req, @Param('profileId') profileId: string) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.artisanService.getMyPromotions(user.id, profileId);
  }

  @Post('promotions/:profileId/:promotionId/cancel')
  @ApiOperation({ summary: 'Cancel an active promotion' })
  @ApiResponse({ status: 200, description: 'Promotion cancelled' })
  async cancelPromotion(
    @Request() req,
    @Param('profileId') profileId: string,
    @Param('promotionId') promotionId: string,
  ) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.artisanService.cancelPromotion(user.id, profileId, promotionId);
  }

  // ─── Earnings ─────────────────────────────────────────

  @Get('earnings/:profileId')
  @ApiOperation({ summary: 'Get earnings and analytics' })
  @ApiResponse({ status: 200, description: 'Earnings data returned' })
  async getEarnings(@Request() req, @Param('profileId') profileId: string) {
    const user = req.isce_auth;
    if (!user) return { success: false, message: 'User not found' };
    return this.artisanService.getEarnings(user.id, profileId);
  }
}

// ═══════════════════════════════════════════════════════════
// Directory Controller — public artisan discovery
// ═══════════════════════════════════════════════════════════

@ApiTags('Artisan Directory')
@Controller('directory')
export class DirectoryController {
  constructor(private readonly artisanService: ArtisanService) {}

  @Get('artisans')
  @PublicRoute()
  @ApiOperation({ summary: 'Browse artisan directory with filters' })
  @ApiResponse({ status: 200, description: 'Artisan listing returned' })
  async directoryListing(@Query(ValidationPipe) query: DirectoryQueryDto) {
    return this.artisanService.directoryListing(query);
  }

  @Get('artisans/featured')
  @PublicRoute()
  @ApiOperation({ summary: 'Get featured artisans' })
  @ApiResponse({ status: 200, description: 'Featured artisans returned' })
  @ApiQuery({ name: 'limit', required: false })
  async getFeatured(@Query('limit') limit?: string) {
    return this.artisanService.getFeaturedArtisans(
      limit ? parseInt(limit) : 10,
    );
  }

  @Get('artisans/:artisanId')
  @PublicRoute()
  @ApiOperation({ summary: 'Get artisan public profile' })
  @ApiResponse({ status: 200, description: 'Artisan profile returned' })
  @ApiResponse({ status: 404, description: 'Artisan not found' })
  async getArtisanProfile(@Param('artisanId') artisanId: string) {
    return this.artisanService.getArtisanPublicProfile(artisanId);
  }

  @Get('artisans/:artisanId/reviews')
  @PublicRoute()
  @ApiOperation({ summary: 'Get artisan reviews' })
  @ApiResponse({ status: 200, description: 'Reviews returned' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getArtisanReviews(
    @Param('artisanId') artisanId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.artisanService.getArtisanReviews(
      artisanId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get('categories')
  @PublicRoute()
  @ApiOperation({ summary: 'Get all categories with artisan counts' })
  @ApiResponse({ status: 200, description: 'Categories returned' })
  async getCategoriesWithCounts() {
    return this.artisanService.getCategoriesWithCounts();
  }
}

// ═══════════════════════════════════════════════════════════
// Artisan Admin Controller — admin operations
// ═══════════════════════════════════════════════════════════

@ApiTags('Artisan Admin')
@ApiBearerAuth('access-token')
@UseGuards(SuperAdminGuard)
@Controller('admin/artisan')
export class ArtisanAdminController {
  constructor(private readonly artisanService: ArtisanService) {}

  @Get('list')
  @ApiOperation({ summary: 'List all artisans (admin)' })
  @ApiResponse({ status: 200, description: 'Artisans returned' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async listArtisans(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.artisanService.adminListArtisans(
      status,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Post(':artisanId/approve')
  @ApiOperation({ summary: 'Approve a pending artisan' })
  @ApiResponse({ status: 200, description: 'Artisan approved' })
  async approve(@Param('artisanId') artisanId: string) {
    return this.artisanService.approveArtisan(artisanId);
  }

  @Post(':artisanId/suspend')
  @ApiOperation({ summary: 'Suspend an artisan' })
  @ApiResponse({ status: 200, description: 'Artisan suspended' })
  async suspend(
    @Param('artisanId') artisanId: string,
    @Body(ValidationPipe) dto: SuspendArtisanDto,
  ) {
    return this.artisanService.suspendArtisan(artisanId, dto.reason);
  }

  @Post(':artisanId/unsuspend')
  @ApiOperation({ summary: 'Unsuspend an artisan' })
  @ApiResponse({ status: 200, description: 'Artisan unsuspended' })
  async unsuspend(@Param('artisanId') artisanId: string) {
    return this.artisanService.unsuspendArtisan(artisanId);
  }

  // ─── Admin Category CRUD ──────────────────────────────

  @Post('categories')
  @ApiOperation({ summary: 'Create a new category' })
  @ApiResponse({ status: 201, description: 'Category created' })
  async createCategory(@Body(ValidationPipe) dto: CreateCategoryDto) {
    return this.artisanService.adminCreateCategory(dto);
  }

  @Patch('categories/:categoryId')
  @ApiOperation({ summary: 'Update a category' })
  @ApiResponse({ status: 200, description: 'Category updated' })
  async updateCategory(
    @Param('categoryId') categoryId: string,
    @Body(ValidationPipe) dto: UpdateCategoryDto,
  ) {
    return this.artisanService.adminUpdateCategory(categoryId, dto);
  }

  @Delete('categories/:categoryId')
  @ApiOperation({ summary: 'Delete a category' })
  @ApiResponse({ status: 200, description: 'Category deleted' })
  async deleteCategory(@Param('categoryId') categoryId: string) {
    return this.artisanService.adminDeleteCategory(categoryId);
  }

  // ─── Admin Reviews ────────────────────────────────────

  @Post('reviews/:reviewId/toggle-visibility')
  @ApiOperation({ summary: 'Toggle review visibility' })
  @ApiResponse({ status: 200, description: 'Review visibility toggled' })
  async toggleReviewVisibility(@Param('reviewId') reviewId: string) {
    return this.artisanService.adminToggleReviewVisibility(reviewId);
  }

  // ─── Platform Settings ────────────────────────────────

  @Get('settings')
  @ApiOperation({ summary: 'Get platform settings' })
  @ApiResponse({ status: 200, description: 'Settings returned' })
  async getSettings() {
    return this.artisanService.getSettings();
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Update platform settings' })
  @ApiResponse({ status: 200, description: 'Settings updated' })
  async updateSettings(@Body(ValidationPipe) dto: UpdatePlatformSettingsDto) {
    return this.artisanService.updateSettings(dto);
  }
}
