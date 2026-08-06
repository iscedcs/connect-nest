import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsArray,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsInt,
  IsEnum,
  IsDateString,
  Min,
  Max,
  MinLength,
  MaxLength,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── Service DTOs ─────────────────────────────────────────

export class CreateServiceDto {
  @ApiProperty({ description: 'Service name', example: 'Haircut' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({
    description: 'Service description',
    example: 'Professional haircut with styling',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Price in minor currency',
    example: 5000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({
    description: 'Currency code',
    example: 'NGN',
    default: 'NGN',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Duration in minutes',
    example: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number;
}

export class UpdateServiceDto {
  @ApiPropertyOptional({ description: 'Service name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ description: 'Service description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Price' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ description: 'Currency code' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'Duration in minutes' })
  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number;

  @ApiPropertyOptional({ description: 'Whether the service is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Display order' })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

// ─── Portfolio DTOs ───────────────────────────────────────

export class AddPortfolioItemDto {
  @ApiProperty({ description: 'Media URL (DO Spaces or external link)' })
  @IsString()
  url: string;

  @ApiPropertyOptional({
    description: 'Type of portfolio item',
    example: 'image',
    default: 'image',
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Thumbnail URL (for videos)' })
  @IsOptional()
  @IsString()
  thumbnail?: string;

  @ApiPropertyOptional({ description: 'Caption' })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiPropertyOptional({ description: 'Display order', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class UpdatePortfolioItemDto {
  @ApiPropertyOptional({ description: 'Caption' })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiPropertyOptional({ description: 'Display order' })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

// ─── Working Hours DTO ────────────────────────────────────

export class WorkingHoursEntryDto {
  @ApiProperty({ description: 'Day of week (0=Sun, 6=Sat)', example: 1 })
  @IsInt()
  @Min(0)
  @Max(6)
  day: number;

  @ApiProperty({ description: 'Opening time', example: '09:00' })
  @IsString()
  open: string;

  @ApiProperty({ description: 'Closing time', example: '17:00' })
  @IsString()
  close: string;

  @ApiProperty({ description: 'Whether open on this day', example: true })
  @IsBoolean()
  isOpen: boolean;
}

// ─── Registration DTO ─────────────────────────────────────

export class RegisterArtisanDto {
  @ApiProperty({ description: 'Profile ID to upgrade to artisan' })
  @IsUUID()
  profileId: string;

  @ApiProperty({
    description:
      'Category IDs (0-3). Can be empty if customCategory is provided.',
    example: ['uuid1', 'uuid2'],
  })
  @IsArray()
  @ArrayMaxSize(3)
  @IsUUID('4', { each: true })
  categoryIds: string[];

  @ApiPropertyOptional({
    description: 'Custom category text (required if "Others" selected)',
  })
  @IsOptional()
  @IsString()
  customCategory?: string;

  @ApiPropertyOptional({
    description: 'Artisan bio / pitch',
    example: 'Expert barber with 5 years experience',
  })
  @IsOptional()
  @IsString()
  @MinLength(20)
  bio?: string;

  @ApiPropertyOptional({
    description: 'Services to offer (can be added later)',
    type: [CreateServiceDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateServiceDto)
  services?: CreateServiceDto[];

  @ApiPropertyOptional({
    description: 'Working hours schedule',
    type: [WorkingHoursEntryDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkingHoursEntryDto)
  workingHours?: WorkingHoursEntryDto[];

  @ApiProperty({ description: 'Must accept terms', example: true })
  @IsBoolean()
  termsAccepted: boolean;
}

// ─── Update Artisan DTO ───────────────────────────────────

export class UpdateArtisanDto {
  @ApiProperty({ description: 'Profile ID of the artisan profile' })
  @IsUUID()
  profileId: string;

  @ApiPropertyOptional({ description: 'Artisan bio / pitch' })
  @IsOptional()
  @IsString()
  @MinLength(20)
  bio?: string;

  @ApiPropertyOptional({
    description: 'Working hours schedule',
    type: [WorkingHoursEntryDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkingHoursEntryDto)
  workingHours?: WorkingHoursEntryDto[];

  @ApiPropertyOptional({ description: 'Custom category text' })
  @IsOptional()
  @IsString()
  customCategory?: string;
}

// ─── Update Categories DTO ────────────────────────────────

export class UpdateCategoriesDto {
  @ApiProperty({ description: 'Profile ID of the artisan profile' })
  @IsUUID()
  profileId: string;

  @ApiProperty({
    description: 'New category IDs (1-3)',
    example: ['uuid1', 'uuid2'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsUUID('4', { each: true })
  categoryIds: string[];
}

// ─── Booking DTOs ─────────────────────────────────────────

export class CreateBookingDto {
  @ApiPropertyOptional({ description: 'Service ID to book' })
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiProperty({
    description: 'Scheduled date',
    example: '2025-03-15',
  })
  @IsString()
  scheduledDate: string;

  @ApiPropertyOptional({
    description: 'Scheduled time',
    example: '14:00',
  })
  @IsOptional()
  @IsString()
  scheduledTime?: string;

  @ApiPropertyOptional({ description: 'Duration in minutes' })
  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number;

  @ApiPropertyOptional({ description: 'Agreed price' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  agreedPrice?: number;

  @ApiPropertyOptional({ description: 'Note to artisan' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Customer name' })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional({ description: 'Customer phone' })
  @IsOptional()
  @IsString()
  customerPhone?: string;
}

export class CancelBookingDto {
  @ApiPropertyOptional({ description: 'Reason for cancellation' })
  @IsOptional()
  @IsString()
  reason?: string;
}

// ─── Review DTO ───────────────────────────────────────────

export class CreateReviewDto {
  @ApiPropertyOptional({ description: 'Booking ID (if reviewing a booking)' })
  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @ApiProperty({ description: 'Rating (1-5)', example: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({
    description: 'Review comment (min 10 chars if provided)',
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  comment?: string;

  @ApiPropertyOptional({
    description: 'Payment reference for eligibility verification',
  })
  @IsOptional()
  @IsString()
  paymentReference?: string;
}

// ─── Promotion DTO ────────────────────────────────────────

export class CreatePromotionDto {
  @ApiProperty({ description: 'Profile ID of the artisan profile' })
  @IsUUID()
  profileId: string;

  @ApiProperty({
    description: 'Promotion type',
    enum: ['SPONSORED', 'BOOST'],
    example: 'BOOST',
  })
  @IsString()
  type: 'SPONSORED' | 'BOOST';

  @ApiProperty({
    description: 'Duration in days',
    example: 1,
  })
  @IsInt()
  @Min(1)
  @Max(30)
  durationDays: number;
}

// ─── Directory Query DTO ──────────────────────────────────

export class DirectoryQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Items per page',
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({ description: 'Category slug filter' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Location text search' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    description: 'Full-text search on name, bio, services',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Minimum average rating (1-5)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['rating', 'newest', 'bookings', 'name'],
    default: 'rating',
  })
  @IsOptional()
  @IsString()
  sortBy?: 'rating' | 'newest' | 'bookings' | 'name';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}

// ─── Admin DTOs ───────────────────────────────────────────

export class SuspendArtisanDto {
  @ApiProperty({ description: 'Reason for suspension' })
  @IsString()
  @MinLength(5)
  reason: string;
}

export class CreateCategoryDto {
  @ApiProperty({ description: 'Category name', example: 'Pet Services' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({
    description: 'URL-safe slug',
    example: 'pet-services',
  })
  @IsString()
  slug: string;

  @ApiPropertyOptional({ description: 'Icon emoji', example: '🐕' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: 'Category description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Display order', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ description: 'Category name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ description: 'Icon emoji' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: 'Category description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Display order' })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ description: 'Whether the category is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ─── Thread / Conversation DTOs ───────────────────────────

export class CreateThreadDto {
  @ApiProperty({ description: 'Artisan ID to start conversation with' })
  @IsUUID()
  artisanId: string;

  @ApiPropertyOptional({ description: 'Service ID the inquiry is about' })
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiProperty({
    description: 'Initial message to the artisan',
    example: 'Hi, I need a haircut this Saturday. Are you available?',
  })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  message: string;

  @ApiPropertyOptional({ description: 'Customer name' })
  @IsOptional()
  @IsString()
  clientName?: string;

  @ApiPropertyOptional({ description: 'Customer phone' })
  @IsOptional()
  @IsString()
  clientPhone?: string;

  @ApiPropertyOptional({ description: 'Customer profile ID' })
  @IsOptional()
  @IsUUID()
  clientProfileId?: string;
}

export class SendMessageDto {
  @ApiProperty({
    description: 'Message content',
    example: 'Sounds good, what time works for you?',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}

export class SendProposalDto {
  @ApiPropertyOptional({ description: 'Service ID for the proposal' })
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiProperty({ description: 'Proposed price', example: 5000 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({
    description: 'Currency code',
    example: 'NGN',
    default: 'NGN',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Proposed date',
    example: '2025-03-15',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Proposed time',
    example: '14:00',
  })
  @IsOptional()
  @IsString()
  time?: string;

  @ApiPropertyOptional({ description: 'Duration in minutes', example: 60 })
  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number;

  @ApiPropertyOptional({
    description: 'Payment preference',
    enum: ['WALLET', 'OFFLINE'],
    default: 'WALLET',
  })
  @IsOptional()
  @IsEnum(['WALLET', 'OFFLINE'])
  paymentPreference?: 'WALLET' | 'OFFLINE';

  @ApiPropertyOptional({
    description: 'Payment timing',
    enum: ['UPFRONT', 'ON_COMPLETION'],
    default: 'ON_COMPLETION',
  })
  @IsOptional()
  @IsEnum(['UPFRONT', 'ON_COMPLETION'])
  paymentTiming?: 'UPFRONT' | 'ON_COMPLETION';

  @ApiPropertyOptional({
    description: 'Note / description for the proposal',
    example: 'Includes wash and styling',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class AcceptProposalDto {
  @ApiProperty({ description: 'The proposal message ID to accept' })
  @IsUUID()
  messageId: string;
}

export class DeclineProposalDto {
  @ApiProperty({ description: 'The proposal message ID to decline' })
  @IsUUID()
  messageId: string;

  @ApiPropertyOptional({ description: 'Reason for declining' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ConfirmPaymentDto {
  @ApiPropertyOptional({
    description: 'Payment reference (transaction ID, receipt, etc.)',
  })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ description: 'Additional note about the payment' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ExecuteWalletPaymentDto {
  @ApiProperty({ description: "Customer's wallet PIN" })
  @IsString()
  pin: string;

  @ApiPropertyOptional({
    description:
      'Set true to proceed after a REQUIRES_CONFIRMATION fraud-check response',
  })
  @IsOptional()
  @IsBoolean()
  confirmFraud?: boolean;
}

export class DisputePaymentDto {
  @ApiProperty({ description: 'Reason for disputing the payment' })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason: string;
}

export class ThreadQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Items per page',
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by thread status',
    enum: ['OPEN', 'PROPOSAL_SENT', 'BOOKED', 'CLOSED'],
  })
  @IsOptional()
  @IsString()
  status?: 'OPEN' | 'PROPOSAL_SENT' | 'BOOKED' | 'CLOSED';
}

// ─── Platform Settings DTO ────────────────────────────────

export class UpdatePlatformSettingsDto {
  @ApiPropertyOptional({
    description: 'Auto-approve artisans when requirements met',
  })
  @IsOptional()
  @IsBoolean()
  artisanAutoApproval?: boolean;

  @ApiPropertyOptional({
    description: 'Commission rate (e.g., 0.025 for 2.5%)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.5)
  artisanCommissionRate?: number;

  @ApiPropertyOptional({ description: 'Sponsored listing price per day' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sponsoredPriceDaily?: number;

  @ApiPropertyOptional({ description: 'Boost price per day' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  boostPriceDaily?: number;

  @ApiPropertyOptional({ description: 'Minimum portfolio items required' })
  @IsOptional()
  @IsInt()
  @Min(1)
  minPortfolioItems?: number;

  @ApiPropertyOptional({ description: 'Maximum categories per artisan' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxCategories?: number;
}
