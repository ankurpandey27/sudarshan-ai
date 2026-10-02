// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { IsIn } from 'class-validator';
import { SiteId } from '../interfaces/site-session.interface';

export class OpenLoginDto {
  @IsIn(['linkedin', 'naukri', 'instahyre', 'indeed', 'foundit', 'hirist', 'himalayas'])
  site!: SiteId;
}
