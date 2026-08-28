import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CpSubscriptionPlan } from '../../../generated/prisma/client';

export class AdminOverrideSubscriptionDto {
  @ApiProperty({
    enum: CpSubscriptionPlan,
    description: 'The plan tier to set for the organization',
  })
  @IsEnum(CpSubscriptionPlan)
  plan: CpSubscriptionPlan;

  @ApiPropertyOptional({
    description: 'Optional reason for the manual override (recorded in audit log)',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
