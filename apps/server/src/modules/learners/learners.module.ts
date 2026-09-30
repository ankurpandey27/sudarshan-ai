// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Module } from '@nestjs/common';
import { EmbeddingsModule } from '../../common/embeddings/embeddings.module';
import { AnswersModule } from '../answers/answers.module';
import { ProfileModule } from '../profile/profile.module';
import { ButtonLearnerService } from './button-learner.service';
import { FieldLearnerService } from './field-learner.service';
import { LearnersTrainerService } from './learners-trainer.service';
import { LearnersController } from './learners.controller';
import { LearnersService } from './learners.service';
import { OutcomeLearnerService } from './outcome-learner.service';
import { QuestionLearnerService } from './question-learner.service';

/** Small models trained on this computer from what Sudarshan does every day. */
@Module({
  imports: [EmbeddingsModule, AnswersModule, ProfileModule],
  controllers: [LearnersController],
  providers: [LearnersService, FieldLearnerService, QuestionLearnerService, ButtonLearnerService, OutcomeLearnerService, LearnersTrainerService],
  exports: [LearnersService, FieldLearnerService, QuestionLearnerService, ButtonLearnerService, OutcomeLearnerService, LearnersTrainerService],
})
export class LearnersModule {}
