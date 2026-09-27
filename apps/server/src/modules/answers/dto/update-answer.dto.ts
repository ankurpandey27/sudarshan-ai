// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAnswerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  answer!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  question?: string;
}
