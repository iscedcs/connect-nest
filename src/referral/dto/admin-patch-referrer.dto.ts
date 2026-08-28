import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum BusinessReferrerStatusAction {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export class AdminPatchReferrerDto {
  @ApiProperty({
    enum: BusinessReferrerStatusAction,
    description: 'New status to apply. businessReferrerReward is required when approving.',
    example: 'APPROVED',
  })
  @IsEnum(BusinessReferrerStatusAction)
  status: BusinessReferrerStatusAction;

  @ApiPropertyOptional({
    description: 'Naira per unit for this business referrer. Required when status is APPROVED. Whole naira — no decimals.',
    example: 1200,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  businessReferrerReward?: number;
}
