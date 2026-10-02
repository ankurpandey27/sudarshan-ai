// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { ProfileCheckService } from './profile-check.service';

@Module({
  imports: [JobsModule],
  controllers: [ProfileController],
  providers: [ProfileService, ProfileCheckService],
  exports: [ProfileService],
})
export class ProfileModule {}
