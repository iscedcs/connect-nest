import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsInt, IsOptional, Max, Min } from 'class-validator';

export class BroadcastLaunchDto {
  @ApiPropertyOptional({
    description: 'If true, simulates the broadcast without sending actual emails or modifying the DB',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean = false;

  @ApiPropertyOptional({
    description: 'Send a single test announcement email to this address before full rollout',
    example: 'admin@example.com',
  })
  @IsOptional()
  @IsEmail()
  testEmail?: string;

  @ApiPropertyOptional({
    description: 'Limit the number of users to process in this run',
    example: 50,
    default: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 100;
}
