// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { ConflictException, Controller, HttpCode, Post, ServiceUnavailableException } from '@nestjs/common';
import { BrowserBusyError } from '../browser/errors/browser-busy.error';
import { BrowserUnavailableError } from '../browser/errors/browser-unavailable.error';
import { AppliedSyncService } from './applied-sync.service';
import { AppliedSyncResult } from './interfaces/applied-sync-result.interface';

@Controller('applied-sync')
export class AppliedSyncController {
  constructor(private readonly sync: AppliedSyncService) {}

  /** Marks the jobs Indeed lists under My jobs -> Applied as Applied here. */
  @Post('indeed')
  @HttpCode(200)
  async indeed(): Promise<AppliedSyncResult> {
    try {
      return await this.sync.syncIndeed();
    } catch (err) {
      if (err instanceof BrowserUnavailableError) throw new ServiceUnavailableException(err.message);
      if (err instanceof BrowserBusyError) throw new ConflictException(err.message);
      throw err;
    }
  }
}
