import { IsInt, IsPositive, IsOptional, IsBoolean, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePlanDto {
  @ApiPropertyOptional({
    description: 'Monthly price in kobo (100 = ₦1). Must be 0 or positive.',
    example: 150000,
  })
  @IsOptional()
  @IsInt({ message: 'priceMonthly must be an integer (kobo)' })
  @IsPositive({ message: 'priceMonthly must be positive' })
  priceMonthly?: number;

  @ApiPropertyOptional({ description: 'Display name for the plan', example: 'Pro Lite' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Whether the plan is visible/selectable' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
