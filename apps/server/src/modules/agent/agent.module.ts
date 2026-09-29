// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Module } from '@nestjs/common';
import { EmbeddingsModule } from '../../common/embeddings/embeddings.module';
import { AnswersModule } from '../answers/answers.module';
import { ApplyModule } from '../apply/apply.module';
import { BrowserModule } from '../browser/browser.module';
import { DiscoveryModule } from '../discovery/discovery.module';
import { JobsModule } from '../jobs/jobs.module';
import { ProfileModule } from '../profile/profile.module';
import { ScoringModule } from '../scoring/scoring.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { InsightsService } from './insights.service';
import { PlatformHealthModule } from '../platform-health/platform-health.module';

@Module({
  imports: [PlatformHealthModule, EmbeddingsModule, AnswersModule, ApplyModule, BrowserModule, DiscoveryModule, JobsModule, ProfileModule, ScoringModule],
  controllers: [AgentController],
  providers: [AgentService, InsightsService],
})
export class AgentModule {}
