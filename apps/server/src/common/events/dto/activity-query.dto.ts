// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class ActivityQueryDto {
  /** Local date, YYYY-MM-DD. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  day?: string;

  @IsOptional()
  @IsIn(['all', 'apply', 'problems'])
  kind?: 'all' | 'apply' | 'problems';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  beforeId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(300)
  limit?: number;

  /** Numbered pages (1 = newest); used instead of beforeId. */
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  /** Only lines about one platform, e.g. "linkedin". */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  source?: string;
}
