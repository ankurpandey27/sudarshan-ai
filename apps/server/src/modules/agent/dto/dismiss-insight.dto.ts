// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { IsString, MaxLength, MinLength } from 'class-validator';

export class DismissInsightDto {
  /** The card's version as shown; it comes back only with a different one. */
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  version!: string;
}
