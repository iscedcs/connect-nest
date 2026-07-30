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

  async isHealthy(key: string = 'database'): Promise<HealthIndicatorResult> {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch (error) {
      const result = this.getStatus(key, false, {
        message: (error as Error).message,
      });
      throw new HealthCheckError('Database health check failed', result);
    }
  }
}
