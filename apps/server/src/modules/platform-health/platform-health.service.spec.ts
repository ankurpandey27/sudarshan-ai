// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { StorageService } from '../../common/storage/storage.service';
import { JobPlatform } from '../jobs/enums/job-platform.enum';
import { PlatformHealthService } from './platform-health.service';

describe('PlatformHealthService', () => {
  // Simulated history happens a day ago, before any real "Try again" stamp.
  let clock = Date.now() - 86_400_000;
  const tick = () => new Date((clock += 60_000)).toISOString();
  let seq = 0;

  const make = () => {
    const storage = new StorageService(':memory:');
    const attempt = (result: string, platform = 'linkedin') => {
      const at = tick();
      const { lastInsertRowid } = storage.run(
        `INSERT INTO jobs (source, external_id, url, title, status, discovered_at, updated_at) VALUES (?, ?, ?, 'Backend', 'manual', ?, ?)`,
        [platform, String(++seq), `https://example.com/${seq}`, at, at],
      );
      storage.run(`INSERT INTO attempts (job_id, started_at, result, detail) VALUES (?, ?, ?, ?)`, [lastInsertRowid, at, result, `ended ${result}`]);
      return Number(lastInsertRowid);
    };
    const applied = (jobId: number) => storage.run(`UPDATE jobs SET status = 'applied', applied_at = ? WHERE id = ?`, [tick(), jobId]);
    return { health: new PlatformHealthService(storage), attempt, applied };
  };

  it('pauses a platform after three stuck applications in a row', () => {
    const { health, attempt } = make();
    attempt('run:stuck');
    attempt('prep:no_apply_button');
    expect(health.state(JobPlatform.LINKEDIN).status).toBe('ok');
    attempt('run:stuck');
    const h = health.state(JobPlatform.LINKEDIN);
    expect(h.status).toBe('broken');
    expect(h.recent[0]).toBe('ended run:stuck');
    // Other platforms are unaffected.
    expect(health.state(JobPlatform.NAUKRI).status).toBe('ok');
  });

  it('never counts captchas, questions or logins as the site changing', () => {
    const { health, attempt } = make();
    attempt('run:stuck');
    attempt('run:captcha');
    attempt('run:stuck');
    expect(health.state(JobPlatform.LINKEDIN).status).toBe('ok');
    attempt('run:needs_input');
    attempt('prep:login_required');
    expect(health.state(JobPlatform.LINKEDIN).status).toBe('ok');
  });

  it('resumes carefully after "Try again", and returns to normal once an application succeeds', () => {
    const { health, attempt, applied } = make();
    for (let i = 0; i < 3; i++) attempt('run:stuck');
    expect(health.state(JobPlatform.LINKEDIN).status).toBe('broken');

    expect(health.retry(JobPlatform.LINKEDIN).status).toBe('careful');
    // What follows happens after the retry.
    clock = Date.now() + 1000;
    const next = attempt('run:ready_to_submit');
    expect(health.state(JobPlatform.LINKEDIN).status).toBe('careful');

    applied(next);
    expect(health.state(JobPlatform.LINKEDIN).status).toBe('ok');
  });

  it('clears the pause when you finish a stuck application by hand', () => {
    const { health, attempt, applied } = make();
    const ids = [attempt('run:stuck'), attempt('run:stuck'), attempt('run:stuck')];
    expect(health.state(JobPlatform.LINKEDIN).status).toBe('broken');
    applied(ids[2]);
    expect(health.state(JobPlatform.LINKEDIN).status).toBe('ok');
  });

  it('never pauses all company sites together, and never counts crashes or timeouts', () => {
    const { health, attempt } = make();
    for (let i = 0; i < 3; i++) attempt('run:stuck', 'web');
    expect(health.state(JobPlatform.OTHER).status).toBe('ok');
    for (let i = 0; i < 3; i++) attempt('error');
    expect(health.state(JobPlatform.LINKEDIN).status).toBe('ok');
  });
});
