import { Module } from '@nestjs/common';
import { CardInteractionsService } from './card-interactions.service';
import { CardInteractionsController } from './card-interactions.controller';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [CardInteractionsController],
  providers: [CardInteractionsService],
})
export class CardInteractionsModule {}
