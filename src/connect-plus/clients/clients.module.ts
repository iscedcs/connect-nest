import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CpGuardsModule } from '../guards/cp-guards.module';
import { CpAuditLogModule } from '../audit-logs/cp-audit-log.module';
import { CpNotificationsModule } from '../notifications/notifications.module';
import { IsceAuthModule } from '../isce-auth/isce-auth.module';
import { CpClientsController } from './clients.controller';
import { CpClientsService } from './clients.service';

@Module({
  imports: [
    DatabaseModule,
    CpGuardsModule,
    CpAuditLogModule,
    CpNotificationsModule,
    IsceAuthModule,
  ],
  controllers: [CpClientsController],
  providers: [CpClientsService],
  exports: [CpClientsService],
})
export class CpClientsModule {}
