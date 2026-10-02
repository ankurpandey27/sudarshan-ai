// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateStoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  promptId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text!: string;
}
