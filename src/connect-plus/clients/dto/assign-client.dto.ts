import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AssignClientDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  assignedStaffId?: string;
}
