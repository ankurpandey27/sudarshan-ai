// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Module } from '@nestjs/common';
import { AnswersModule } from '../answers/answers.module';
import { FormEngineModule } from '../form-engine/form-engine.module';
import { JobsModule } from '../jobs/jobs.module';
import { LearningService } from './learning.service';

@Module({
  imports: [AnswersModule, FormEngineModule, JobsModule],
  providers: [LearningService],
  exports: [LearningService],
})
export class LearningModule {}
