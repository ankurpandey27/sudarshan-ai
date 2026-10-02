// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { EventsService } from '../../common/events/events.service';
import { AgentEventType } from '../../common/events/enums/agent-event-type.enum';
import { AgentEvent } from '../../common/events/interfaces/agent-event.interface';
import { StorageService } from '../../common/storage/storage.service';
import { JobStatus } from '../jobs/enums/job-status.enum';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from './notifications.service';
import { TelegramService } from './telegram.service';

describe('notifications', () => {
  const setup = (agent: Record<string, unknown> = {}) => {
    const storage = new StorageService(':memory:');
    const events = new EventsService(storage);
    const settings = { get: () => ({ agent: { dailySummaryHour: 21, notifyNeedsYou: true, ...agent } }) } as unknown as SettingsService;
    const sent: string[] = [];
    const telegram = { send: jest.fn(async (title: string) => (sent.push(title), true)) } as unknown as TelegramService;
    const svc = new NotificationsService(storage, events, settings, telegram);
    const notes: AgentEvent[] = [];
    events.stream().subscribe((e) => e.type === AgentEventType.NOTIFY && notes.push(e));
    let id = 0;
    const job = (status: JobStatus, extra: { source?: string; applied?: string; reason?: string } = {}) => {
      const now = new Date().toISOString();
      storage.run(
        'INSERT INTO jobs (id, source, external_id, url, title, company, status, reason, discovered_at, updated_at, applied_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [++id, extra.source ?? 'linkedin', `x${id}`, `https://x.test/${id}`, `Job ${id}`, 'Acme', status, extra.reason ?? null, now, now, extra.applied ?? null],
      );
      return id;
    };
    return { storage, events, svc, sent, notes, job };
  };

  it("counts today's applications by site, and what waits for you", () => {
    const { svc, job } = setup();
    const now = new Date().toISOString();
    job(JobStatus.APPLIED, { source: 'linkedin', applied: now });
    job(JobStatus.APPLIED, { source: 'naukri', applied: now });
    job(JobStatus.APPLIED, { source: 'naukri', applied: now });
    job(JobStatus.MANUAL, { reason: 'Captcha' });
    job(JobStatus.FAILED);
    const s = svc.summary();
    expect(s.applied).toEqual([
      { platform: 'Naukri', count: 2 },
      { platform: 'LinkedIn', count: 1 },
    ]);
    expect(s).toMatchObject({ found: 5, needsYou: 1, failed: 1 });
  });

  it('sends the summary once a day, at or after the chosen hour', async () => {
    const { svc, sent, notes } = setup();
    const at = (h: number, day = 2) => new Date(2026, 9, day, h, 5);
    expect(await svc.summaryIfDue(at(20))).toBe(false);
    expect(await svc.summaryIfDue(at(21))).toBe(true);
    expect(await svc.summaryIfDue(at(23))).toBe(false);
    expect(await svc.summaryIfDue(at(21, 3))).toBe(true);
    expect(sent).toHaveLength(2);
    expect(notes[0].data).toMatchObject({ kind: 'summary' });
  });

  it('sends no summary when it is turned off', async () => {
    const { svc } = setup({ dailySummaryHour: -1 });
    expect(await svc.summaryIfDue(new Date(2026, 9, 2, 23))).toBe(false);
  });

  it('gathers applications that stop for you into one message', async () => {
    jest.useFakeTimers();
    try {
      const { svc, events, sent, job } = setup();
      svc.onApplicationBootstrap();
      for (const reason of ['Filled - only the captcha is left', 'Account needed']) {
        const id = job(JobStatus.MANUAL, { reason });
        events.emit({ type: AgentEventType.LOG, level: 'warn', jobId: id, message: reason });
      }
      // Applied, or a warning about a job that does not wait for you: not counted.
      const ok = job(JobStatus.APPLIED);
      events.emit({ type: AgentEventType.LOG, level: 'warn', jobId: ok, message: 'slow' });
      expect(sent).toEqual([]);
      await jest.advanceTimersByTimeAsync(2 * 60_000);
      expect(sent).toEqual(['2 applications need you']);
      svc.onApplicationShutdown();
    } finally {
      jest.useRealTimers();
    }
  });
});
