import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { DatabaseModule } from '../database/database.module';
import { CpChatModule } from '../connect-plus/chat/chat.module';
import { HealthMonitorService } from './health-monitor.service';
import { HealthAdminController } from './health-admin.controller';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './indicators/prisma-health.indicator';

@Module({
  imports: [
    TerminusModule,
    DatabaseModule,
    CpChatModule, // provides CpChatGateway for WebSocket broadcast
  ],
  providers: [HealthMonitorService, PrismaHealthIndicator],
  controllers: [HealthController, HealthAdminController],
  exports: [HealthMonitorService, PrismaHealthIndicator],
})
export class HealthModule {}

