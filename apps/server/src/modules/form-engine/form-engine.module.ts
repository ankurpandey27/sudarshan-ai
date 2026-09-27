// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Module } from '@nestjs/common';
import { AnswersModule } from '../answers/answers.module';
import { AnswerEngineService } from './answer-engine.service';
import { FormRunnerService } from './form-runner.service';
import { RecipesService } from './recipes.service';
import { PlaybookService } from './playbook.service';

@Module({
  imports: [AnswersModule],
  providers: [AnswerEngineService, FormRunnerService, RecipesService, PlaybookService],
  exports: [AnswerEngineService, FormRunnerService, RecipesService, PlaybookService],
})
export class FormEngineModule {}
