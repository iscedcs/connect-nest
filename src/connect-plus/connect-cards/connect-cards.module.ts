import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CpGuardsModule } from '../guards/cp-guards.module';
import { CpAuditLogModule } from '../audit-logs/cp-audit-log.module';
import { CpConnectCardsService } from './connect-cards.service';
import {
  CpConnectCardsController,
  CpPublicCardTapController,
} from './connect-cards.controller';

@Module({
  imports: [DatabaseModule, CpGuardsModule, CpAuditLogModule],
  controllers: [CpConnectCardsController, CpPublicCardTapController],
  providers: [CpConnectCardsService],
  exports: [CpConnectCardsService],
})
export class CpConnectCardsModule {}
