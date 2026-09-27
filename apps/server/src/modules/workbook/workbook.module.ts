// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Module } from '@nestjs/common';
import { AnswersModule } from '../answers/answers.module';
import { JobsModule } from '../jobs/jobs.module';
import { ProfileModule } from '../profile/profile.module';
import { WorkbookController } from './workbook.controller';
import { WorkbookService } from './workbook.service';

@Module({
  imports: [AnswersModule, JobsModule, ProfileModule],
  controllers: [WorkbookController],
  providers: [WorkbookService],
})
export class WorkbookModule {}
