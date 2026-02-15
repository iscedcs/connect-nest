import { Module } from '@nestjs/common';
import { CardInteractionsService } from './card-interactions.service';
import { CardInteractionsController } from './card-interactions.controller';
import { DatabaseModule } from 'src/database/database.module';
import { DatabaseService } from 'src/database/database.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [CardInteractionsController],
  providers: [CardInteractionsService, DatabaseService],
})
export class CardInteractionsModule {}
