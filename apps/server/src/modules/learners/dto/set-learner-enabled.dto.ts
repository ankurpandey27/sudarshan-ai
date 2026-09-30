// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { IsBoolean } from 'class-validator';

export class SetLearnerEnabledDto {
  @IsBoolean()
  enabled!: boolean;
}
