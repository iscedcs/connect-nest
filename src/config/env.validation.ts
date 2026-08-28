/**
 * Fail-fast environment validation using class-validator.
 * The server will refuse to boot if any required variable is missing or invalid.
 * Used by ConfigModule.forRoot({ validate }) in app.module.ts.
 */

import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsString({ message: 'DATABASE_URL must be a string' })
  @IsNotEmpty({ message: 'DATABASE_URL is required' })
  DATABASE_URL: string;

  @IsOptional()
  @IsString()
  JWT_SECRET?: string;

  @ValidateIf((o) => o.NODE_ENV === Environment.Production)
  @IsNotEmpty({ message: 'JWT_ACCESS_SECRET is required in production' })
  @IsString({ message: 'JWT_ACCESS_SECRET must be a string' })
  JWT_ACCESS_SECRET?: string;

  @ValidateIf((o) => o.NODE_ENV === Environment.Production)
  @IsNotEmpty({ message: 'INTERNAL_API_KEY is required in production' })
  @IsString({ message: 'INTERNAL_API_KEY must be a string' })
  INTERNAL_API_KEY?: string;

  @ValidateIf((o) => o.NODE_ENV === Environment.Production)
  @IsNotEmpty({ message: 'PAYSTACK_SECRET_KEY is required in production' })
  @IsString({ message: 'PAYSTACK_SECRET_KEY must be a string' })
  PAYSTACK_SECRET_KEY?: string;

  @ValidateIf((o) => o.NODE_ENV === Environment.Production)
  @IsNotEmpty({ message: 'AUTH_INVITE_WEBHOOK_SECRET is required in production' })
  @IsString({ message: 'AUTH_INVITE_WEBHOOK_SECRET must be a string' })
  AUTH_INVITE_WEBHOOK_SECRET?: string;

  @ValidateIf(
    (o) =>
      o.NODE_ENV === Environment.Production &&
      !o.AWS_ACCESS_KEY_ID,
  )
  @IsNotEmpty({
    message: 'DO_SPACES_KEY (or AWS_ACCESS_KEY_ID) is required in production',
  })
  @IsString()
  DO_SPACES_KEY?: string;

  @ValidateIf(
    (o) =>
      o.NODE_ENV === Environment.Production &&
      !o.AWS_SECRET_ACCESS_KEY,
  )
  @IsNotEmpty({
    message: 'DO_SPACES_SECRET (or AWS_SECRET_ACCESS_KEY) is required in production',
  })
  @IsString()
  DO_SPACES_SECRET?: string;

  @IsOptional()
  @IsString()
  AWS_ACCESS_KEY_ID?: string;

  @IsOptional()
  @IsString()
  AWS_SECRET_ACCESS_KEY?: string;

  @IsOptional()
  @IsString()
  DO_SPACES_ENDPOINT?: string;

  @IsOptional()
  @IsString()
  DO_SPACES_BUCKET?: string;

  @IsOptional()
  @IsString()
  DO_SPACES_REGION?: string;

  @IsOptional()
  @IsNumber()
  PORT: number = 4990;

  @IsOptional()
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;
}

export function validate(config: Record<string, any>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const messages = errors.map((err) => Object.values(err.constraints || {})).flat();
    throw new Error(`Environment validation failed:\n - ${messages.join('\n - ')}`);
  }
  return validatedConfig;
}


