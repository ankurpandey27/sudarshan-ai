import { Module } from '@nestjs/common';
import { BrowserModule } from '../browser/browser.module';
import { JobsModule } from '../jobs/jobs.module';
import { ProfileModule } from '../profile/profile.module';
import { DiscoveryService } from './discovery.service';
import { LinkedInSource } from './sources/linkedin.source';
import { NaukriSource } from './sources/naukri.source';

@Module({
  imports: [BrowserModule, JobsModule, ProfileModule],
  providers: [DiscoveryService, LinkedInSource, NaukriSource],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
