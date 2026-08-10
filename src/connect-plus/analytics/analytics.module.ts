import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { DatabaseModule } from '../../database/database.module';
import { CpGuardsModule } from '../guards/cp-guards.module';
import { CpAnalyticsController } from './analytics.controller';
import { CpAnalyticsService } from './analytics.service';

@Module({
  imports: [
    DatabaseModule,
    CpGuardsModule,
    CacheModule.register({
      ttl: 300_000, // 5 min default TTL (ms); swap store for Redis via env
      max: 100,
    }),
  ],
  controllers: [CpAnalyticsController],
  providers: [CpAnalyticsService],
  exports: [CpAnalyticsService],
})
export class CpAnalyticsModule {}
