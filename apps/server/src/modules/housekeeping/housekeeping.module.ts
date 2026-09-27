// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Module } from '@nestjs/common';
import { ProfileModule } from '../profile/profile.module';
import { HousekeepingService } from './housekeeping.service';

@Module({
  imports: [ProfileModule],
  providers: [HousekeepingService],
})
export class HousekeepingModule {}
