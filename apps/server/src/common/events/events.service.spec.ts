// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { StorageService } from '../storage/storage.service';
import { localDay } from '../utils/date.util';
import { AgentEventType } from './enums/agent-event-type.enum';
import { EventsService } from './events.service';

describe('EventsService flight log', () => {
  it('keeps log lines, application steps and questions across restarts - not internal signals', () => {
    const storage = new StorageService(':memory:');
    const before = new EventsService(storage);
    before.emit({ type: AgentEventType.LOG, level: 'success', message: 'Applied to Backend Engineer @ Acme', jobId: 7, source: 'linkedin' });
    before.emit({ type: AgentEventType.APPLY_STEP, message: 'Step 2: "Next"', jobId: 7 });
    before.emit({ type: AgentEventType.QUESTION_PENDING, level: 'warn', message: 'Needs your answer: "Notice period?"', jobId: 7 });
    before.emit({ type: AgentEventType.JOB_UPDATED, message: 'job 7 changed' });

    const after = new EventsService(storage);
    expect(after.recent().map((e) => e.type)).toEqual([AgentEventType.LOG, AgentEventType.APPLY_STEP, AgentEventType.QUESTION_PENDING]);
    const next = after.emit({ type: AgentEventType.LOG, message: 'Agent started' });
    expect(next.id).toBeGreaterThan(after.recent()[0].id);
  });

  it('forgets lines older than 7 days', () => {
    const storage = new StorageService(':memory:');
    const old = new Date(Date.now() - 8 * 86_400_000).toISOString();
    const recent = new Date(Date.now() - 6 * 86_400_000).toISOString();
    storage.run("INSERT INTO activity (at, type, level, message) VALUES (?, 'log', 'info', 'eight days ago')", [old]);
    storage.run("INSERT INTO activity (at, type, level, message) VALUES (?, 'log', 'info', 'six days ago')", [recent]);
    const events = new EventsService(storage);
    expect(events.activity({}).items.map((e) => e.message)).toEqual(['six days ago']);
  });

  it('filters the saved log by kind, text and day, newest first, in pages', () => {
    const events = new EventsService(new StorageService(':memory:'));
    events.emit({ type: AgentEventType.LOG, message: 'Searching now' });
    events.emit({ type: AgentEventType.LOG, level: 'success', message: 'Backend @ Acme: Applied in 5 step(s)', jobId: 1 });
    events.emit({ type: AgentEventType.LOG, level: 'warn', message: 'Frontend @ Zeta: Captcha - finish it', jobId: 2 });
    events.emit({ type: AgentEventType.LOG, level: 'error', message: 'Naukri search failed' });

    expect(events.activity({}).items.map((e) => e.message)[0]).toBe('Naukri search failed');
    expect(events.activity({ kind: 'problems' }).items.map((e) => e.message)).toEqual(['Naukri search failed', 'Frontend @ Zeta: Captcha - finish it']);
    expect(events.activity({ kind: 'apply' }).items).toHaveLength(2);
    expect(events.activity({ search: 'acme' }).items.map((e) => e.message)).toEqual(['Backend @ Acme: Applied in 5 step(s)']);
    expect(events.activity({ day: '2020-01-01' }).items).toEqual([]);

    const page1 = events.activity({ limit: 3 });
    expect(page1.hasMore).toBe(true);
    const page2 = events.activity({ limit: 3, beforeId: page1.items.at(-1)!.id });
    expect(page2.items.map((e) => e.message)).toEqual(['Searching now']);
    expect(page2.hasMore).toBe(false);

    expect(events.activity({}).days).toEqual([{ day: localDay(), lines: 4, problems: 2 }]);
  });

  it('pages the saved log by number and filters it by platform', () => {
    const events = new EventsService(new StorageService(':memory:'));
    for (let i = 1; i <= 25; i++) events.emit({ type: AgentEventType.LOG, message: `line ${i}`, source: i % 5 === 0 ? 'naukri' : 'linkedin' });

    const p1 = events.activity({ limit: 10, page: 1 });
    const p3 = events.activity({ limit: 10, page: 3 });
    expect(p1.total).toBe(25);
    expect(p1.items[0].message).toBe('line 25');
    expect(p3.items.map((e) => e.message)).toEqual(['line 5', 'line 4', 'line 3', 'line 2', 'line 1']);

    const naukri = events.activity({ source: 'naukri', limit: 10, page: 1 });
    expect(naukri.total).toBe(5);
    expect(naukri.items.every((e) => e.source === 'naukri')).toBe(true);
  });

  it('exports the lines shown, with the same filters, as a spreadsheet-safe CSV (2026-09-30)', () => {
    const events = new EventsService(new StorageService(':memory:'));
    events.emit({ type: AgentEventType.LOG, level: 'success', message: 'Applied to Backend, Node @ Acme', jobId: 7, source: 'linkedin' });
    events.emit({ type: AgentEventType.LOG, level: 'error', message: '=Indeed search failed', source: 'indeed' });
    events.emit({ type: AgentEventType.LOG, level: 'info', message: 'Agent started' });
    const lines = (csv: string) =>
      csv
        .replace(/^\uFEFF/, '')
        .trim()
        .split(/\r\n/);
    const all = events.exportCsv({});
    expect(lines(all)[0]).toBe('Date,Time,Level,Platform,Job,Message');
    expect(lines(all)).toHaveLength(4);
    // A comma stays in its cell; a line starting with "=" never runs as a formula.
    expect(all).toContain(',success,linkedin,7,"Applied to Backend, Node @ Acme"');
    expect(all).toContain(",error,indeed,,'=Indeed search failed");
    expect(lines(events.exportCsv({ kind: 'problems' }))).toHaveLength(2);
    expect(events.exportCsv({ search: 'Acme' })).toContain('Acme');
    expect(events.exportCsv({ search: 'Acme' })).not.toContain('Agent started');
  });
});
