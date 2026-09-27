// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { ProfileModule } from '../profile/profile.module';
import { KeywordFilterService } from './keyword-filter.service';
import { ScoringEngine } from './scoring-engine.service';
import { ScoringService } from './scoring.service';

@Module({
  imports: [JobsModule, ProfileModule],
  providers: [ScoringService, ScoringEngine, KeywordFilterService],
  exports: [ScoringService],
})
export class ScoringModule {}
