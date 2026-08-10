import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AssignLeadDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  assignedStaffId?: string;
}
