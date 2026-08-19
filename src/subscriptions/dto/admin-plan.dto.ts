import {
  IsInt,
  IsPositive,
  IsOptional,
  IsBoolean,
  IsString,
  IsObject,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePlanLimitsDto {
  @ApiPropertyOptional({ description: 'Number of active profiles allowed (-1 for unlimited)', example: 2 })
  @IsOptional()
  profiles?: number;

  @ApiPropertyOptional({ description: 'Taps allowed per day (-1 for unlimited)', example: -1 })
  @IsOptional()
  tapsPerDay?: number;

  @ApiPropertyOptional({ description: 'Number of social links allowed (-1 for unlimited)', example: 5 })
  @IsOptional()
  socialLinks?: number;

  @ApiPropertyOptional({ description: 'Number of videos allowed (-1 for unlimited)', example: 5 })
  @IsOptional()
  videos?: number;

  @ApiPropertyOptional({ description: 'Number of files allowed (-1 for unlimited)', example: 10 })
  @IsOptional()
  files?: number;

  @ApiPropertyOptional({ description: 'Storage quota in bytes (-1 for unlimited)', example: 52428800 })
  @IsOptional()
  storageBytes?: number;

  @ApiPropertyOptional({ description: 'Number of meeting links allowed (-1 for unlimited)', example: -1 })
  @IsOptional()
  meetingLinks?: number;

  @ApiPropertyOptional({ description: 'Number of custom forms allowed (-1 for unlimited)', example: 1 })
  @IsOptional()
  customForms?: number;

  @ApiPropertyOptional({ description: 'Analytics retention days (-1 for unlimited)', example: 15 })
  @IsOptional()
  analyticsHistoryDays?: number;

  @ApiPropertyOptional({ description: 'Allow vCard / contact export', example: true })
  @IsOptional()
  @IsBoolean()
  contactExport?: boolean;

  @ApiPropertyOptional({ description: 'Remove ISCE branding from profile', example: true })
  @IsOptional()
  @IsBoolean()
  removeIsceBranding?: boolean;

  @ApiPropertyOptional({ description: 'Theme customization level: none | basic | full', example: 'basic' })
  @IsOptional()
  @IsString()
  themeCustomization?: 'none' | 'basic' | 'full';

  @ApiPropertyOptional({ description: 'Enable module reordering', example: true })
  @IsOptional()
  @IsBoolean()
  moduleReordering?: boolean;

  @ApiPropertyOptional({ description: 'Number of Spotify items allowed (-1 for unlimited)', example: 3 })
  @IsOptional()
  spotifyItems?: number;

  @ApiPropertyOptional({ description: 'Number of crypto wallets allowed (-1 for unlimited)', example: 1 })
  @IsOptional()
  cryptoWallets?: number;

  @ApiPropertyOptional({ description: 'Number of service categories allowed (-1 for unlimited)', example: 3 })
  @IsOptional()
  serviceCategories?: number;

  @ApiPropertyOptional({ description: 'Artisan directory visibility', example: true })
  @IsOptional()
  @IsBoolean()
  artisanDirectoryEligible?: boolean;

  @ApiPropertyOptional({ description: 'Public search indexing', example: true })
  @IsOptional()
  @IsBoolean()
  publiclySearchable?: boolean;

  @ApiPropertyOptional({ description: 'Verified badge icon on profile', example: false })
  @IsOptional()
  @IsBoolean()
  verifiedBadge?: boolean;

  @ApiPropertyOptional({ description: 'Priority customer support', example: false })
  @IsOptional()
  @IsBoolean()
  prioritySupport?: boolean;

  @ApiPropertyOptional({ description: 'Priority ranking in search/discovery', example: false })
  @IsOptional()
  @IsBoolean()
  priorityRanking?: boolean;
}

export class UpdatePlanWithLimitsDto {
  @ApiPropertyOptional({
    description: 'Monthly price in kobo (100 = ₦1, 0 for Free)',
    example: 100000,
  })
  @IsOptional()
  @IsInt({ message: 'priceMonthly must be an integer in kobo' })
  @Min(0, { message: 'priceMonthly must be 0 or greater' })
  priceMonthly?: number;

  @ApiPropertyOptional({ description: 'Display name for the plan', example: 'Pro Lite' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Whether the plan is active/selectable', example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Custom feature limits and quotas for this tier' })
  @IsOptional()
  @IsObject()
  limits?: UpdatePlanLimitsDto;
}
