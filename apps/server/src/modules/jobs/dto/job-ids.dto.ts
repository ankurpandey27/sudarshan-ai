// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt } from 'class-validator';

export class JobIdsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  ids!: number[];
}
