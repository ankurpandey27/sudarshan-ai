// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { IsUrl } from 'class-validator';

export class OpenUrlDto {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url!: string;
}
