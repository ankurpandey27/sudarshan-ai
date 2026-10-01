// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { AnswersController } from './answers.controller';
import { AnswersService } from './answers.service';
import { PendingQuestionsService } from './pending-questions.service';
import { PastAnswersService } from './past-answers.service';
import { EmbeddingsModule } from '../../common/embeddings/embeddings.module';
import { TranslationService } from './translation.service';

@Module({
  imports: [JobsModule, EmbeddingsModule],
  controllers: [AnswersController],
  providers: [AnswersService, PendingQuestionsService, PastAnswersService, TranslationService],
  exports: [AnswersService, PendingQuestionsService, PastAnswersService, TranslationService],
})
export class AnswersModule {}
