// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { IsString, MaxLength } from 'class-validator';

export class TelegramTokenDto {
  @IsString()
  @MaxLength(200)
  token!: string;
}
