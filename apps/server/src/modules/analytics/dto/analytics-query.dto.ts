// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { JobPlatform } from '../../jobs/enums/job-platform.enum';
import { ANALYTICS_RANGES } from '../constants/analytics.constants';

export class AnalyticsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsIn(ANALYTICS_RANGES)
  days?: (typeof ANALYTICS_RANGES)[number];

  @IsOptional()
  @IsEnum(JobPlatform)
  platform?: JobPlatform;
}
