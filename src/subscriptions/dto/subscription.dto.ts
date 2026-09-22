import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlanTier } from '../../generated/prisma/client';

export class SelectPlanDto {
  @ApiProperty({ enum: PlanTier, example: PlanTier.PRO_LITE })
  @IsEnum(PlanTier)
  planKey: PlanTier;
}

export class InitiatePaymentDto {
  @ApiProperty({ enum: PlanTier, example: PlanTier.PRO_LITE })
  @IsEnum(PlanTier)
  planKey: PlanTier;

  @ApiPropertyOptional({ description: 'Redirect URL after payment completion' })
  @IsOptional()
  @IsString()
  callbackUrl?: string;

  @ApiPropertyOptional({
    description: 'Payment gateway to use (PAYSTACK | PAYDESTAL)',
    example: 'PAYSTACK',
  })
  @IsOptional()
  @IsString()
  gateway?: string;

  @ApiPropertyOptional({
    enum: ['CARD', 'WALLET'],
    default: 'CARD',
    description:
      'CARD: a Paystack checkout. WALLET: a payment from the Fiscus wallet, which ' +
      'the user then approves with their PIN at wallet-nest.',
  })
  @IsOptional()
  @IsIn(['CARD', 'WALLET'])
  method?: 'CARD' | 'WALLET';

  @ApiPropertyOptional({
    default: true,
    description:
      'Renew automatically from this card or wallet each month. Always on for a trial, ' +
      'whose first month is charged when it ends.',
  })
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;
}

/** The card wallet-nest saved from a checkout: its id and label, never the token. */
export class SavedCardDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty({ example: '4081' })
  @IsString()
  last4: string;

  @ApiPropertyOptional({ example: 'visa' })
  @IsOptional()
  @IsString()
  brand: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bank: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expMonth: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expYear: string | null;
}

/** A Paystack webhook event as wallet-nest forwards it. */
export class ForwardedPaystackEventDto {
  @ApiProperty({ example: 'charge.success' })
  @IsString()
  event: string;

  @ApiProperty({
    description:
      "Paystack's event data, with the card's authorization_code redacted",
  })
  @IsObject()
  data: Record<string, any>;

  @ApiPropertyOptional({
    type: SavedCardDto,
    description: 'Set when the checkout asked wallet-nest to keep the card',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SavedCardDto)
  savedCard?: SavedCardDto;
}

/** A wallet payment as wallet-nest delivers it once the money has moved. */
export class WalletPaymentDeliveryDto {
  @ApiProperty()
  @IsString()
  paymentId: string;

  @ApiProperty()
  @IsString()
  reference: string;

  @ApiProperty()
  @IsString()
  userId: string;

  @ApiProperty({ example: 150000 })
  @IsInt()
  @Min(1)
  amountKobo: number;

  @ApiPropertyOptional({
    description: 'What connect-nest attached when it created the payment',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'The wallet mandate granted with this payment, if any',
  })
  @IsOptional()
  @IsString()
  mandateId?: string | null;
}
