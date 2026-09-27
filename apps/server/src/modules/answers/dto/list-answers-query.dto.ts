// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ListAnswersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
