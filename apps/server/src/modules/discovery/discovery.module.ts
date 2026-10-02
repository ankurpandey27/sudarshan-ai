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
import { FounditSource } from './sources/foundit.source';
import { HiristSource } from './sources/hirist.source';
import { HimalayasSource } from './sources/himalayas.source';

@Module({
  imports: [BrowserModule, JobsModule, ProfileModule],
  providers: [DiscoveryService, LinkedInSource, NaukriSource, InstahyreSource, IndeedSource, FounditSource, HiristSource, HimalayasSource],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
