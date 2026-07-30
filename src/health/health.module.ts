import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { HealthAdminController } from './health-admin.controller';
import { PrismaHealthIndicator } from './indicators/prisma-health.indicator';
import { HealthMonitorService } from './health-monitor.service';
import { DatabaseModule } from '../database/database.module';
import { MailClientModule } from '../mail/mail-client.module';

@Module({
  imports: [TerminusModule, DatabaseModule, MailClientModule],
  controllers: [HealthController, HealthAdminController],
  providers: [PrismaHealthIndicator, HealthMonitorService],
  exports: [HealthMonitorService],
})
export class HealthModule {}
