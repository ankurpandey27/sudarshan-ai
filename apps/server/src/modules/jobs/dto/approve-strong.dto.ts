// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { JobPlatform } from '../enums/job-platform.enum';

export class ApproveStrongDto {
  @IsInt()
  @Min(0)
  @Max(100)
  minScore!: number;

  @IsOptional()
  @IsEnum(JobPlatform)
  platform?: JobPlatform;
}
