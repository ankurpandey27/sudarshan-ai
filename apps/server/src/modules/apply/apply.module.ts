import { Module } from '@nestjs/common';
import { AnswersModule } from '../answers/answers.module';
import { BrowserModule } from '../browser/browser.module';
import { FormEngineModule } from '../form-engine/form-engine.module';
import { JobsModule } from '../jobs/jobs.module';
import { ProfileModule } from '../profile/profile.module';
import { LinkedInApplyAdapter } from './adapters/linkedin.adapter';
import { NaukriApplyAdapter } from './adapters/naukri.adapter';
import { WebApplyAdapter } from './adapters/web.adapter';
import { ApplyService } from './apply.service';

@Module({
  imports: [AnswersModule, BrowserModule, FormEngineModule, JobsModule, ProfileModule],
  providers: [ApplyService, LinkedInApplyAdapter, NaukriApplyAdapter, WebApplyAdapter],
  exports: [ApplyService],
})
export class ApplyModule {}
