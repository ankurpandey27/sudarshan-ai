// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Module } from '@nestjs/common';
import { RescueService } from './rescue.service';
import { AnswersModule } from '../answers/answers.module';
import { LearnersModule } from '../learners/learners.module';
import { AnswerEngineService } from './answer-engine.service';
import { FormRunnerService } from './form-runner.service';
import { RecipesService } from './recipes.service';
import { PlaybookService } from './playbook.service';

@Module({
  imports: [AnswersModule, LearnersModule],
  providers: [RescueService, AnswerEngineService, FormRunnerService, RecipesService, PlaybookService],
  exports: [AnswerEngineService, FormRunnerService, RecipesService, PlaybookService, RescueService],
})
export class FormEngineModule {}
