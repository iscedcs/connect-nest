/**
 * Fail-fast environment validation using class-validator.
 * The server will refuse to boot if any required variable is missing or invalid.
 * Used by ConfigModule.forRoot({ validate }) in app.module.ts.
 */

import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsString()
  DATABASE_URL: string;

  @IsOptional()
  @IsString()
  JWT_SECRET?: string;

  @IsOptional()
  @IsString()
  JWT_ACCESS_SECRET?: string;

  @IsOptional()
  @IsString()
  INTERNAL_API_KEY?: string;

  @IsOptional()
  @IsString()
  PAYSTACK_SECRET_KEY?: string;

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

