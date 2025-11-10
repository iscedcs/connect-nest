import { Module } from '@nestjs/common';
import { FormsController, FormTemplatesController } from './forms.controller';
import { FormsService } from './forms.service';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [FormsController, FormTemplatesController],
  providers: [FormsService],
  exports: [FormsService],
})
export class FormsModule {}

