import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { AnswersController } from './answers.controller';
import { AnswersService } from './answers.service';
import { PendingQuestionsService } from './pending-questions.service';

@Module({
  imports: [JobsModule],
  controllers: [AnswersController],
  providers: [AnswersService, PendingQuestionsService],
  exports: [AnswersService, PendingQuestionsService],
})
export class AnswersModule {}
