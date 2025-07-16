import { Module } from '@nestjs/common';
import { CardService } from './card.service';
import { CardController } from './card.controller';
import { DatabaseService } from 'src/database/database.service';

@Module({
  controllers: [CardController],
  providers: [CardService, DatabaseService],
})
export class CardModule {}
