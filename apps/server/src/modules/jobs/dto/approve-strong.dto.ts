// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { IsArray, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { JobRegion, WorkMode } from '../enums/job-place.enum';
import { JobPlatform } from '../enums/job-platform.enum';

export class ApproveStrongDto {
  @IsInt()
  @Min(0)
  @Max(100)
  minScore!: number;

  @IsOptional()
  @IsEnum(JobPlatform)
  platform?: JobPlatform;

  // The same filters as the Review list, so "Approve all" approves what you see.
  @IsOptional()
  @IsArray()
  @IsEnum(WorkMode, { each: true })
  workMode?: WorkMode[];

  @IsOptional()
  @IsEnum(JobRegion)
  region?: JobRegion;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  exclude?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  withinDays?: number;
}
