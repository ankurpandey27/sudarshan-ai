// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Module } from '@nestjs/common';
import { BrowserModule } from '../browser/browser.module';
import { JobsModule } from '../jobs/jobs.module';
import { AppliedSyncController } from './applied-sync.controller';
import { AppliedSyncService } from './applied-sync.service';

/** Brings in applications a job site confirms but Sudarshan AI missed (e.g. finished by hand). */
@Module({
  imports: [BrowserModule, JobsModule],
  controllers: [AppliedSyncController],
  providers: [AppliedSyncService],
  exports: [AppliedSyncService],
})
export class AppliedSyncModule {}
