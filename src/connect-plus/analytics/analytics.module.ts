import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { BullModule } from '@nestjs/bull';
import { DatabaseModule } from '../../database/database.module';
import { CpGuardsModule } from '../guards/cp-guards.module';
import { CpAnalyticsController } from './analytics.controller';
import { CpAnalyticsService } from './analytics.service';
import { AnalyticsProcessor } from './analytics.processor';
import { ANALYTICS_QUEUE } from './analytics.queue';

@Module({
  imports: [
    DatabaseModule,
    CpGuardsModule,
    CacheModule.register({
      ttl: 300_000, // 5 min default TTL (ms); swap store for Redis via env
      max: 100,
    }),
    BullModule.registerQueue({
      name: ANALYTICS_QUEUE,
    }),
  ],
  controllers: [CpAnalyticsController],
  providers: [CpAnalyticsService, AnalyticsProcessor],
  exports: [CpAnalyticsService],
})
export class CpAnalyticsModule {}


