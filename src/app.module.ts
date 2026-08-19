import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { ReferralModule } from './referral/referral.module';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth/auth.guard';
import { ContactModule } from './contact/contact.module';
import { DatabaseModule } from './database/database.module';
import { ProfileModule } from './profile/profile.module';
import { ProfileContactModule } from './profile-contact/profile-contact.module';
import { LinksModule } from './links/links.module';
import { VideosModule } from './videos/videos.module';
import { MeetingsModule } from './meetings/meetings.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { SpotifyModule } from './spotify/spotify.module';
import { FilesModule } from './files/files.module';
import { FormsModule } from './forms/forms.module';
import { WalletsModule } from './wallets/wallets.module';
import { ConnectConfigModule } from './connect-config/connect-config.module';
import { SocialModule } from './social/social.module';
import { NotificationModule } from './notification/notification.module';
import { SupportRequestModule } from './support-request/support-request.module';
import { CardInteractionsModule } from './card-interactions/card-interactions.module';
import { DeviceProfileModule } from './device-profile/device-profile.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PushModule } from './push/push.module';
import { ArtisanModule } from './artisan/artisan.module';
import { InternalModule } from './internal/internal.module';
import { MailClientModule } from './mail/mail-client.module';
import { ConnectPlusModule } from './connect-plus/connect-plus.module';
import { SentryModule } from '@sentry/nestjs/setup';
import { HealthModule } from './health/health.module';
import { ScheduleModule } from '@nestjs/schedule';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { SystemConfigModule } from './system-config/system-config.module';

@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 30,
      },
    ]),
    ScheduleModule.forRoot(),
    SystemConfigModule,
    SubscriptionsModule,
    AuthModule,
    DatabaseModule,
    ContactModule,
    ProfileModule,
    ProfileContactModule,
    LinksModule,
    VideosModule,
    MeetingsModule,
    AppointmentsModule,
    SpotifyModule,
    FilesModule,
    FormsModule,
    WalletsModule,
    ConnectConfigModule,
    SocialModule,
    NotificationModule,
    SupportRequestModule,
    CardInteractionsModule,
    DeviceProfileModule,
    PushModule,
    ArtisanModule,
    InternalModule,
    MailClientModule,
    ConnectPlusModule,
    ReferralModule,
    HealthModule,
  ],
})
export class AppModule {}
