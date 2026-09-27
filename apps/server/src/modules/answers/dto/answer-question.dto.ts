// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AnswerQuestionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  key!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  answer!: string;
}
