import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlanTier } from '../../generated/prisma/client';

export class SelectPlanDto {
  @ApiProperty({ enum: PlanTier, example: PlanTier.PRO_LITE })
  @IsEnum(PlanTier)
  planKey: PlanTier;
}

export class InitiatePaymentDto {
  @ApiProperty({ enum: PlanTier, example: PlanTier.PRO_LITE })
  @IsEnum(PlanTier)
  planKey: PlanTier;

  @ApiPropertyOptional({ description: 'Redirect URL after payment completion' })
  @IsOptional()
  @IsString()
  callbackUrl?: string;

  @ApiPropertyOptional({ description: 'Payment gateway to use (PAYSTACK | PAYDESTAL)', example: 'PAYSTACK' })
  @IsOptional()
  @IsString()
  gateway?: string;
}

