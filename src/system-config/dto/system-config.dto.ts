import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum SubscriptionBypassMode {
  OPEN_ACCESS = 'OPEN_ACCESS',
  FREE_TIER_ONLY = 'FREE_TIER_ONLY',
}

export class UpdateSubscriptionConfigDto {
  @ApiPropertyOptional({
    description: 'Toggle for Connect (Personal / B2C) subscriptions',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  personalSubscriptionsEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Toggle for Connect Plus (B2B / Organizations) subscriptions',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  connectPlusSubscriptionsEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Behavior when subscriptions are disabled (OPEN_ACCESS = unlimited features, FREE_TIER_ONLY = locked to free limits)',
    enum: SubscriptionBypassMode,
    example: SubscriptionBypassMode.OPEN_ACCESS,
  })
  @IsOptional()
  @IsEnum(SubscriptionBypassMode)
  bypassMode?: SubscriptionBypassMode;

  @ApiPropertyOptional({
    description: 'Optional maintenance or promotional reason displayed to users',
    example: 'Free access during beta launch',
  })
  @IsOptional()
  @IsString()
  maintenanceReason?: string;
}
