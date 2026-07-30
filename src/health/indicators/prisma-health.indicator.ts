import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(private readonly db: DatabaseService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      throw new HealthCheckError(
        'Prisma health check failed',
        this.getStatus(key, false, { message: errMessage }),
      );
    }
  }
}
