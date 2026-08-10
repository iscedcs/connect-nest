import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CpSubscriptionPlan } from '../../../generated/prisma/client';

export class UpgradePlanDto {
  @ApiProperty({ enum: CpSubscriptionPlan })
  @IsEnum(CpSubscriptionPlan)
  plan: CpSubscriptionPlan;

  @ApiPropertyOptional({ description: 'Paystack subscription code' })
  @IsOptional()
  @IsString()
  paystackSubCode?: string;

  @ApiPropertyOptional({ description: 'Paystack customer code' })
  @IsOptional()
  @IsString()
  paystackCustomerCode?: string;
}
