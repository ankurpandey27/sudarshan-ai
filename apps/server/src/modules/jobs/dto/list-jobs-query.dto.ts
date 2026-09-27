// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { JobSource } from '../enums/job-source.enum';
import { JobPlatform } from '../enums/job-platform.enum';
import { JobStatus } from '../enums/job-status.enum';

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
  @IsIn(['score', 'recent', 'applied', 'taste'])
  sort?: 'score' | 'recent' | 'applied' | 'taste';

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
