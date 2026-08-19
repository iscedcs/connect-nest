import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { DatabaseModule } from 'src/database/database.module';
import { DatabaseService } from 'src/database/database.service';
import { EmailService } from './email.service';
import { NotificationGateway } from './notification.gateway';
import { NotificationDispatcher } from './notification-dispatcher.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    EmailService,
    NotificationGateway,
    NotificationDispatcher,
    DatabaseService,
  ],
  exports: [NotificationService, NotificationDispatcher, EmailService],
})
export class NotificationModule {}
