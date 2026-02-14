import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateWalletDto {
  @ApiProperty({ description: 'Blockchain network', example: 'eth' })
  @IsString()
  network: string;

  @ApiProperty({
    description: 'Wallet address',
    example: '0x1234abcdEF5678901234abcdEF5678901234abcd',
  })
  @IsString()
  address: string;

  @ApiPropertyOptional({ description: 'Wallet label', example: 'Main ETH' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ description: 'ENS name', example: 'myname.eth' })
  @IsOptional()
  @IsString()
  ens?: string;

  @ApiPropertyOptional({
    description: 'Whether this wallet is visible',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_visible?: boolean;
}

export class UpdateWalletDto {
  @ApiPropertyOptional({ description: 'Blockchain network', example: 'eth' })
  @IsOptional()
  @IsString()
  network?: string;

  @ApiPropertyOptional({
    description: 'Wallet address',
    example: '0x1234abcdEF5678901234abcdEF5678901234abcd',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Wallet label', example: 'Main ETH' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ description: 'ENS name', example: 'myname.eth' })
  @IsOptional()
  @IsString()
  ens?: string;

  @ApiPropertyOptional({
    description: 'Whether this wallet is visible',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_visible?: boolean;
}

export {
  BulkVisibilityDto,
  BulkDeleteDto,
  BulkRestoreDto,
} from '../../common/dto/bulk-operations.dto';

export class WalletResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the wallet',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Profile ID this wallet belongs to',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  profileId: string;

  @ApiProperty({ description: 'Blockchain network', example: 'eth' })
  network: string;

  @ApiProperty({
    description: 'Wallet address',
    example: '0x1234abcdEF5678901234abcdEF5678901234abcd',
  })
  address: string;

  @ApiPropertyOptional({ description: 'Wallet label', example: 'Main ETH' })
  label?: string;

  @ApiPropertyOptional({ description: 'ENS name', example: 'myname.eth' })
  ens?: string;

  @ApiProperty({
    description: 'Whether this is the default wallet',
    example: false,
  })
  is_default: boolean;

  @ApiProperty({ description: 'Whether this wallet is visible', example: true })
  is_visible: boolean;

  @ApiProperty({
    description: 'Timestamp when the wallet was created',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the wallet was last updated',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Timestamp when the wallet was deleted (soft delete)',
    example: '2024-01-01T00:00:00.000Z',
  })
  deletedAt?: Date;
}
