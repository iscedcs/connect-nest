import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
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
}
