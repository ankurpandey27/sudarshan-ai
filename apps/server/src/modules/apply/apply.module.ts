// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Module } from '@nestjs/common';
import { AnswersModule } from '../answers/answers.module';
import { LearnersModule } from '../learners/learners.module';
import { BrowserModule } from '../browser/browser.module';
import { FormEngineModule } from '../form-engine/form-engine.module';
import { JobsModule } from '../jobs/jobs.module';
import { LearningModule } from '../learning/learning.module';
import { ProfileModule } from '../profile/profile.module';
import { LinkedInApplyAdapter } from './adapters/linkedin.adapter';
import { NaukriApplyAdapter } from './adapters/naukri.adapter';
import { IndeedApplyAdapter } from './adapters/indeed.adapter';
import { WebApplyAdapter } from './adapters/web.adapter';
import { ApplyService } from './apply.service';
import { PlatformHealthModule } from '../platform-health/platform-health.module';
import { StoriesModule } from '../stories/stories.module';

@Module({
  imports: [PlatformHealthModule, LearnersModule, AnswersModule, BrowserModule, FormEngineModule, JobsModule, LearningModule, ProfileModule, StoriesModule],
  providers: [ApplyService, LinkedInApplyAdapter, NaukriApplyAdapter, IndeedApplyAdapter, WebApplyAdapter],
  exports: [ApplyService],
})
export class ApplyModule {}
