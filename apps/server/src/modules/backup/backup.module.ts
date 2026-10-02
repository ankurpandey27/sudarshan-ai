// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Module } from '@nestjs/common';
import { ProfileModule } from '../profile/profile.module';
import { SettingsModule } from '../settings/settings.module';
import { ResumesModule } from '../resumes/resumes.module';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';

@Module({
  imports: [ProfileModule, SettingsModule, ResumesModule],
  controllers: [BackupController],
  providers: [BackupService],
  exports: [BackupService],
})
export class BackupModule {}
