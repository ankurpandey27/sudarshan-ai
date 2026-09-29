// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { AnswersController } from './answers.controller';
import { AnswersService } from './answers.service';
import { PendingQuestionsService } from './pending-questions.service';
import { PastAnswersService } from './past-answers.service';
import { EmbeddingsModule } from '../../common/embeddings/embeddings.module';

@Module({
  imports: [JobsModule, EmbeddingsModule],
  controllers: [AnswersController],
  providers: [AnswersService, PendingQuestionsService, PastAnswersService],
  exports: [AnswersService, PendingQuestionsService, PastAnswersService],
})
export class AnswersModule {}
