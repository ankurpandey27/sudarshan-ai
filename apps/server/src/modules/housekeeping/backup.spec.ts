// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../../common/storage/storage.service';
import { ProfileService } from '../profile/profile.service';
import { HousekeepingService } from './housekeeping.service';

describe('daily backup of your data (2026-10-01)', () => {
  let dir: string;
  beforeEach(() => (dir = mkdtempSync(join(tmpdir(), 'sudarshan-backup-'))));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('copies the whole database once a day, readable on its own, and keeps the last 7', () => {
    const storage = new StorageService(join(dir, 'agent.db'));
    storage.run("INSERT INTO answers (key, question, answer, source, created_at, updated_at) VALUES ('k', 'Notice period', '30 days', 'user', 'x', 'x')");
    const config = { getOrThrow: () => join(dir, 'backups') } as unknown as ConfigService;
    const svc = new HousekeepingService(config, storage, {} as ProfileService);

    const file = svc.backUp('2026-10-01');
    expect(file).toBeTruthy();
    // Once a day: a second run that day does nothing.
    expect(svc.backUp('2026-10-01')).toBeNull();
    const copy = new DatabaseSync(file!, { readOnly: true });
    expect(copy.prepare('SELECT answer FROM answers').get()).toEqual(expect.objectContaining({ answer: '30 days' }));
    copy.close();

    for (let d = 2; d <= 10; d++) svc.backUp(`2026-10-${String(d).padStart(2, '0')}`);
    expect(readdirSync(join(dir, 'backups')).sort()).toEqual(['04', '05', '06', '07', '08', '09', '10'].map((d) => `agent-2026-10-${d}.db`));
    storage.onApplicationShutdown();
  });
});
