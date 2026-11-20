import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CpOrganizationsModule } from '../connect-plus/organizations/organizations.module';
import { CpWorkspacesModule } from '../connect-plus/workspaces/workspaces.module';
import { ProfileModule } from '../profile/profile.module';
import { InternalController } from './internal.controller';
import { InternalGuard } from './internal.guard';
import { InternalService } from './internal.service';

@Module({
  imports: [
    DatabaseModule,
    CpOrganizationsModule,
    CpWorkspacesModule,
    ProfileModule,
  ],
  controllers: [InternalController],
  providers: [InternalService, InternalGuard],
})
export class InternalModule {}
