import {
  IsInt,
  IsOptional,
  IsBoolean,
  IsString,
  IsObject,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CpPlanLimitsDto {
  @ApiPropertyOptional({
    description: 'Max workspaces allowed (-1 for unlimited)',
    example: 3,
  })
  @IsOptional()
  @IsInt()
  workspaces?: number;

  @ApiPropertyOptional({
    description: 'Max staff per workspace allowed (-1 for unlimited)',
    example: 15,
  })
  @IsOptional()
  @IsInt()
  staffPerWorkspace?: number;

  @ApiPropertyOptional({
    description: 'Max clients per workspace allowed (-1 for unlimited)',
    example: 100,
  })
  @IsOptional()
  @IsInt()
  clientsPerWorkspace?: number;
}

export class UpdateCpPlanDto {
  @ApiPropertyOptional({
    description: 'Display name of the LYNCON Plus plan',
    example: 'Starter',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Monthly price in kobo (100 = ₦1, 0 for Free)',
    example: 500000,
  })
  @IsOptional()
  @IsInt({ message: 'priceMonthly must be an integer in kobo' })
  @Min(0, { message: 'priceMonthly must be 0 or greater' })
  priceMonthly?: number;

  @ApiPropertyOptional({
    description: 'Whether the plan is available for selection',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Resource quotas for this LYNCON Plus tier',
  })
  @IsOptional()
  @IsObject()
  limits?: CpPlanLimitsDto;
}
