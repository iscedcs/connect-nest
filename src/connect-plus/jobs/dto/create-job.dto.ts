import { IsString, IsNotEmpty, IsEnum, IsOptional, IsArray, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobType, WorkModel } from '../../../generated/prisma/client';

export class CreateJobDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ enum: JobType })
  @IsEnum(JobType)
  jobType: JobType;

  @ApiProperty({ enum: WorkModel })
  @IsEnum(WorkModel)
  workModel: WorkModel;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  requiredSkills: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  minBudget?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxBudget?: number;
}
