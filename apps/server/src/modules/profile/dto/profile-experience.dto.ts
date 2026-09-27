// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { IsBoolean, IsString, MaxLength } from 'class-validator';

export class ProfileExperienceDto {
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsString()
  @MaxLength(120)
  company!: string;

  @IsString()
  @MaxLength(120)
  location!: string;

  @IsString()
  @MaxLength(20)
  start!: string;

  @IsString()
  @MaxLength(20)
  end!: string;

  @IsBoolean()
  current!: boolean;

  @IsString()
  @MaxLength(1000)
  summary!: string;
}
