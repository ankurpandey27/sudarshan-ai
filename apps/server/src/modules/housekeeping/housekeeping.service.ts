// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../../common/storage/storage.service';
import { ProfileService } from '../profile/profile.service';
import { localDay } from '../../common/utils/date.util';
import { HOUSEKEEPING_EVERY_MS, KEEP_BACKUPS, KEEP_LOGS_MS, KEEP_OLD_UPLOADS_MS, KEEP_SCREENSHOTS_MS } from './constants/housekeeping.constants';
import { pruneDir } from './utils/prune-dir.util';

/** Keeps the data folder from growing forever: old screenshots, logs and resume uploads. */
@Injectable()
export class HousekeepingService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(HousekeepingService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly storage: StorageService,
    private readonly profile: ProfileService,
  ) {}

  onApplicationBootstrap(): void {
    this.run();
    this.timer = setInterval(() => this.run(), HOUSEKEEPING_EVERY_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * A full copy of the database once a day (SQLite's VACUUM INTO: consistent while the app runs), the last 7 kept.
   * Your answers, learned steps and history in one file - one bad disk write must not lose them.
   */
  backUp(today = localDay()): string | null {
    const dir = this.config.getOrThrow<string>('paths.backups');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `agent-${today}.db`);
    if (existsSync(file)) return null;
    this.storage.run('VACUUM INTO ?', [file]);
    const old = readdirSync(dir)
      .filter((f) => /^agent-\d{4}-\d{2}-\d{2}\.db$/.test(f))
      .sort()
      .slice(0, -KEEP_BACKUPS);
    for (const f of old) rmSync(join(dir, f), { force: true });
    this.logger.log(`Backed up your data to ${file}`);
    return file;
  }

  run(): void {
    try {
      const shots = pruneDir(this.config.getOrThrow<string>('paths.screenshots'), KEEP_SCREENSHOTS_MS);
      // Attempts keep their history; only the missing picture is forgotten.
      for (const path of shots) this.storage.run('UPDATE attempts SET screenshot = NULL WHERE screenshot = ?', [path]);
      const logs = pruneDir(this.config.getOrThrow<string>('paths.logs'), KEEP_LOGS_MS);
      const uploads = pruneDir(this.config.getOrThrow<string>('paths.uploads'), KEEP_OLD_UPLOADS_MS, [this.profile.resumePath()]);
      this.backUp();
      const total = shots.length + logs.length + uploads.length;
      if (total) this.logger.log(`Cleared ${shots.length} old screenshot(s), ${logs.length} log file(s), ${uploads.length} old resume upload(s)`);
    } catch (err) {
      this.logger.warn(`Cleanup skipped: ${(err as Error).message}`);
    }
  }
}
