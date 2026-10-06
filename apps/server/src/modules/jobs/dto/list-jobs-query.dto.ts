// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { JobSource } from '../enums/job-source.enum';
import { JobPlatform } from '../enums/job-platform.enum';
import { JobStatus } from '../enums/job-status.enum';
import { JobRegion, WorkMode } from '../enums/job-place.enum';

export class ListJobsQueryDto {
  // ?status=review,approved
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  @IsArray()
  @IsEnum(JobStatus, { each: true })
  status?: JobStatus[];

  @IsOptional()
  @IsEnum(JobSource)
  source?: JobSource;

  @IsOptional()
  @IsEnum(JobPlatform)
  platform?: JobPlatform;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  // "newest": by when the job was posted (or found, when the site does not say).
  // "queue": the order approved jobs are applied in.
  @IsIn(['score', 'recent', 'applied', 'taste', 'newest', 'queue'])
  sort?: 'score' | 'recent' | 'applied' | 'taste' | 'newest' | 'queue';

  /** With sort=queue: jobs in your country first, as the agent does when that setting is on. */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  homeFirst?: boolean;

  // ?workMode=remote,hybrid
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  @IsArray()
  @IsEnum(WorkMode, { each: true })
  workMode?: WorkMode[];

  @IsOptional()
  @IsEnum(JobRegion)
  region?: JobRegion;

  // ?exclude=java,php: no job whose title, skills or description has one of these words.
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').map((t: string) => t.trim()).filter(Boolean) : value))
  @IsArray()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  exclude?: string[];

  /** Only jobs posted (or found) in the last N days. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  withinDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  /** Only jobs scoring at least this, e.g. to count strong matches across every page. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  minScore?: number;
}
