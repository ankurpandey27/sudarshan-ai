// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SkipQuestionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  key!: string;
}
