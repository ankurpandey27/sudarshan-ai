// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Module } from '@nestjs/common';
import { BrowserModule } from '../browser/browser.module';
import { JobsModule } from '../jobs/jobs.module';
import { ProfileModule } from '../profile/profile.module';
import { DiscoveryService } from './discovery.service';
import { LinkedInSource } from './sources/linkedin.source';
import { NaukriSource } from './sources/naukri.source';
import { InstahyreSource } from './sources/instahyre.source';
import { IndeedSource } from './sources/indeed.source';

@Module({
  imports: [BrowserModule, JobsModule, ProfileModule],
  providers: [DiscoveryService, LinkedInSource, NaukriSource, InstahyreSource, IndeedSource],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
