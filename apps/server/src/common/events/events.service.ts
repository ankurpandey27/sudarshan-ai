// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable, Logger, Optional } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { SQLInputValue } from 'node:sqlite';
import { StorageService } from '../storage/storage.service';
import { ACTIVITY_KEEP_DAYS, ACTIVITY_MAX_ROWS, ACTIVITY_PRUNE_EVERY_MS, EVENT_HISTORY, LOGGED_EVENT_TYPES } from './constants/events.constants';
import { ActivityQueryDto } from './dto/activity-query.dto';
import { AgentEventType } from './enums/agent-event-type.enum';
import { ActivityDay, ActivityPage } from './interfaces/activity-page.interface';
import { ActivityRow } from './interfaces/activity-row.interface';
import { AgentEvent, AgentEventInput, AgentEventLevel } from './interfaces/agent-event.interface';

/**
 * In-process event bus behind the SSE stream. Flight-log lines are also saved
 * for ACTIVITY_KEEP_DAYS, so the log survives restarts and can be searched;
 * storage is optional for unit tests.
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger('Agent');
  private readonly subject = new Subject<AgentEvent>();
  private readonly history: AgentEvent[] = [];
  private seq = 0;
  private lastPrune = 0;

  constructor(@Optional() private readonly storage?: StorageService) {
    this.prune();
    this.restore();
  }

  emit(input: AgentEventInput): AgentEvent {
    const event: AgentEvent = { ...input, level: input.level ?? 'info', id: ++this.seq, at: new Date().toISOString() };
    this.history.push(event);
    if (this.history.length > EVENT_HISTORY) this.history.shift();
    this.subject.next(event);
    if (LOGGED_EVENT_TYPES.includes(event.type)) this.persist(event);
    if (event.type === AgentEventType.LOG) {
      const line = event.source ? `[${event.source}] ${event.message}` : event.message;
      if (event.level === 'error') this.logger.error(line);
      else if (event.level === 'warn') this.logger.warn(line);
      else this.logger.log(line);
    }
    return event;
  }

  stream(): Observable<AgentEvent> {
    return this.subject.asObservable();
  }

  recent(limit = 200): AgentEvent[] {
    return this.history.slice(-limit);
  }

  /** The saved flight log, newest first, filtered by day, kind and text. */
  activity(q: ActivityQueryDto): ActivityPage {
    const empty: ActivityPage = { items: [], hasMore: false, days: [], keepDays: ACTIVITY_KEEP_DAYS };
    if (!this.storage) return empty;
    const where: string[] = [];
    const params: SQLInputValue[] = [];
    if (q.day) {
      const [y, m, d] = q.day.split('-').map(Number);
      where.push('at >= ? AND at < ?');
      params.push(new Date(y, m - 1, d).toISOString(), new Date(y, m - 1, d + 1).toISOString());
    }
    if (q.kind === 'apply') where.push(`(job_id IS NOT NULL OR type = '${AgentEventType.APPLY_STEP}')`);
    if (q.kind === 'problems') where.push(`level IN ('warn', 'error')`);
    if (q.search?.trim()) {
      where.push('message LIKE ?');
      params.push(`%${q.search.trim()}%`);
    }
    if (q.beforeId) {
      where.push('id < ?');
      params.push(q.beforeId);
    }
    const limit = q.limit ?? 100;
    const rows = this.storage.all<ActivityRow>(`SELECT * FROM activity ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC LIMIT ?`, [
      ...params,
      limit + 1,
    ]);
    return {
      items: rows.slice(0, limit).map((r) => this.toEvent(r, r.id)),
      hasMore: rows.length > limit,
      days: this.days(),
      keepDays: ACTIVITY_KEEP_DAYS,
    };
  }

  private days(): ActivityDay[] {
    return this.storage!.all<{ day: string; lines: number; problems: number }>(
      `SELECT date(at, 'localtime') day, COUNT(*) lines, SUM(level IN ('warn', 'error')) problems
       FROM activity GROUP BY day ORDER BY day DESC`,
    ).map((d) => ({ day: d.day, lines: Number(d.lines), problems: Number(d.problems ?? 0) }));
  }

  private toEvent(r: ActivityRow, id: number): AgentEvent {
    return {
      id,
      at: r.at,
      type: (r.type as AgentEventType) || AgentEventType.LOG,
      level: r.level as AgentEventLevel,
      message: r.message,
      ...(r.job_id !== null ? { jobId: r.job_id } : {}),
      ...(r.source !== null ? { source: r.source } : {}),
    };
  }

  private restore(): void {
    if (!this.storage) return;
    try {
      const rows = this.storage.all<ActivityRow>('SELECT * FROM activity ORDER BY id DESC LIMIT ?', [EVENT_HISTORY]).reverse();
      for (const r of rows) this.history.push(this.toEvent(r, ++this.seq));
    } catch (err) {
      this.logger.warn(`Could not load the saved flight log: ${(err as Error).message}`);
    }
  }

  private persist(e: AgentEvent): void {
    if (!this.storage) return;
    try {
      this.storage.run('INSERT INTO activity (at, type, level, message, job_id, source) VALUES (?, ?, ?, ?, ?, ?)', [
        e.at,
        e.type,
        e.level,
        e.message,
        e.jobId ?? null,
        e.source ?? null,
      ]);
      if (Date.now() - this.lastPrune > ACTIVITY_PRUNE_EVERY_MS) this.prune();
    } catch {
      // Logging must never break the agent.
    }
  }

  /** Drops lines older than the retention window (and anything over the safety cap). */
  private prune(): void {
    if (!this.storage) return;
    this.lastPrune = Date.now();
    try {
      const cutoff = new Date(Date.now() - ACTIVITY_KEEP_DAYS * 86_400_000).toISOString();
      this.storage.run('DELETE FROM activity WHERE at < ?', [cutoff]);
      this.storage.run('DELETE FROM activity WHERE id <= (SELECT MAX(id) FROM activity) - ?', [ACTIVITY_MAX_ROWS]);
    } catch {
      // Logging must never break the agent.
    }
  }
}
