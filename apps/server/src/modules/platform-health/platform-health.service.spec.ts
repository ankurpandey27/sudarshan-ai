// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { StorageService } from '../../common/storage/storage.service';
import { JobPlatform } from '../jobs/enums/job-platform.enum';
import { PlatformHealthService } from './platform-health.service';

describe('PlatformHealthService', () => {
  // Simulated history happens two hours ago: before any real "Try again" stamp, within the 6-hour pause.
  let clock = Date.now() - 2 * 3_600_000;
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

  it('pauses a site that refuses applications, and carries on by itself when the pause is over (Naukri, 2026-09-29)', () => {
    const health = new PlatformHealthService(new StorageService(':memory:'));
    const paused = health.coolDown(JobPlatform.NAUKRI, 3 * 60 * 60_000, 'Naukri is refusing applications for now');
    expect(paused.status).toBe('cooling');
    expect(Date.parse(paused.until!)).toBeGreaterThan(Date.now());
    expect(paused.recent).toEqual(['Naukri is refusing applications for now']);
    // Other sites are not affected.
    expect(health.state(JobPlatform.LINKEDIN).status).toBe('ok');
    // A pause that is already over: back to normal, not careful or broken.
    expect(health.coolDown(JobPlatform.NAUKRI, -1000, 'old').status).toBe('ok');
  });

  it('is never paused for ever: one new attempt 6 hours after the last stuck one (Naukri, 2026-09-30)', () => {
    const storage = new StorageService(':memory:');
    const stuckAt = (hoursAgo: number, n: number) => {
      const at = new Date(Date.now() - hoursAgo * 3_600_000).toISOString();
      storage.run(
        `INSERT INTO jobs (source, external_id, url, title, status, discovered_at, updated_at) VALUES ('naukri', ?, 'https://www.naukri.com/x', 'Dev', 'manual', ?, ?)`,
        [`n${n}`, at, at],
      );
      storage.run(`INSERT INTO attempts (job_id, started_at, result, detail) VALUES (?, ?, 'run:stuck', 'Naukri did not confirm the application')`, [n, at]);
    };
    // Three stuck a day ago (really: refusals before they were recognised) - paused since then until now.
    stuckAt(25, 1);
    stuckAt(24.9, 2);
    stuckAt(24.8, 3);
    const health = new PlatformHealthService(storage);
    expect(health.state(JobPlatform.NAUKRI).status).toBe('ok');
    // That one new try gets stuck too: paused again, for another 6 hours, and it says until when.
    stuckAt(0, 4);
    const again = health.state(JobPlatform.NAUKRI);
    expect(again.status).toBe('broken');
    expect(Date.parse(again.until!) - Date.now()).toBeGreaterThan(5.9 * 3_600_000);
  });
});
