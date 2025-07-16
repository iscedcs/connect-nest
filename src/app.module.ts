import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth/auth.guard';
import { CardModule } from './card/card.module';
import { ContactModule } from './contact/contact.module';
import { DatabaseModule } from './database/database.module';



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
    CardModule,
    ContactModule,
  ],
})
export class AppModule {}
