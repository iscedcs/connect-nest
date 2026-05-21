import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CpInvitesController } from './invites.controller';
import { CpInvitesService } from './invites.service';

@Module({
  imports: [DatabaseModule],
  controllers: [CpInvitesController],
  providers: [CpInvitesService],
  exports: [CpInvitesService],
})
export class CpInvitesModule {}
