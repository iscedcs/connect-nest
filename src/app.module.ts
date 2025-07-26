import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth/auth.guard';
import { ContactModule } from './contact/contact.module';
import { DatabaseModule } from './database/database.module';
import { ProfileModule } from './profile/profile.module';
import { SocialModule } from './social/social.module';
import { NotificationModule } from './notification/notification.module';
import { SupportRequestModule } from './support-request/support-request.module';
import { CardInteractionsModule } from './card-interactions/card-interactions.module';


@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  imports: [
    AuthModule,
    DatabaseModule,
    ContactModule,
    ProfileModule,
    SocialModule,
    NotificationModule,
    SupportRequestModule,
    CardInteractionsModule,
  ],
})
export class AppModule {}
