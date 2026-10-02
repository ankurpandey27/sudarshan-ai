// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Subscription } from 'rxjs';
import { EventsService } from '../../common/events/events.service';
import { AgentEventType } from '../../common/events/enums/agent-event-type.enum';
import { AgentEvent } from '../../common/events/interfaces/agent-event.interface';
import { StorageService } from '../../common/storage/storage.service';
import { localDay, localDayStartIso } from '../../common/utils/date.util';
import { PLATFORM_LABEL, PLATFORM_SQL } from '../jobs/constants/job-platform.constants';
import { JobPlatform } from '../jobs/enums/job-platform.enum';
import { JobStatus } from '../jobs/enums/job-status.enum';
import { SettingsService } from '../settings/settings.service';
import { NEEDS_YOU_GATHER_MS, SUMMARY_CHECK_MS, SUMMARY_SENT_KEY } from './constants/notifications.constants';
import { DaySummary, NotificationKind } from './interfaces/notification.interface';
import { TelegramService } from './telegram.service';
import { needsYouText, summaryText } from './utils/summary-text.util';

/**
 * Tells you what happened without you watching: a summary of the day at the hour you choose, and - gathered
 * into one message - applications that stopped for you (a captcha, a question only you can answer). Shown as a
 * desktop notification by the open app, and sent to your phone when Telegram is connected.
 */
@Injectable()
export class NotificationsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | null = null;
  private gatherTimer: NodeJS.Timeout | null = null;
  private sub: Subscription | null = null;
  private readonly waiting = new Map<number, { label: string; why: string }>();

  constructor(
    private readonly storage: StorageService,
    private readonly events: EventsService,
    private readonly settings: SettingsService,
    private readonly telegram: TelegramService,
  ) {}

  onApplicationBootstrap(): void {
    this.sub = this.events.stream().subscribe((e) => this.onEvent(e));
    this.timer = setInterval(() => void this.summaryIfDue(), SUMMARY_CHECK_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    this.sub?.unsubscribe();
    if (this.timer) clearInterval(this.timer);
    if (this.gatherTimer) clearTimeout(this.gatherTimer);
  }

  /** Sends to every place you get notifications: the open app (desktop notification) and Telegram. */
  async notify(kind: NotificationKind, title: string, body: string): Promise<{ telegram: boolean }> {
    this.events.emit({ type: AgentEventType.NOTIFY, level: kind === 'needs_you' ? 'warn' : 'info', message: title, data: { kind, title, body } });
    return { telegram: await this.telegram.send(title, body) };
  }

  summary(now = new Date()): DaySummary {
    const since = localDayStartIso(now);
    const count = (sql: string, params: string[] = []) => Number(this.storage.get<{ n: number }>(sql, params)?.n ?? 0);
    const applied = this.storage.all<{ p: JobPlatform; n: number }>(
      `SELECT ${PLATFORM_SQL} p, COUNT(*) n FROM jobs WHERE status = ? AND applied_at >= ? GROUP BY p ORDER BY n DESC`,
      [JobStatus.APPLIED, since],
    );
    return {
      day: localDay(now),
      found: count('SELECT COUNT(*) n FROM jobs WHERE discovered_at >= ?', [since]),
      applied: applied.map((a) => ({ platform: PLATFORM_LABEL[a.p] ?? a.p, count: Number(a.n) })),
      needsYou: count('SELECT COUNT(*) n FROM jobs WHERE status IN (?, ?)', [JobStatus.MANUAL, JobStatus.NEEDS_INPUT]),
      questions: count("SELECT COUNT(*) n FROM pending_questions WHERE status = 'open'"),
      failed: count('SELECT COUNT(*) n FROM jobs WHERE status = ? AND updated_at >= ?', [JobStatus.FAILED, since]),
    };
  }

  /** The day's summary once a day, at or after the hour you chose (or now, when `force`). */
  async summaryIfDue(now = new Date(), force = false): Promise<boolean> {
    const hour = this.settings.get().agent.dailySummaryHour;
    const today = localDay(now);
    if (!force) {
      if (hour === null || hour === undefined || hour < 0 || now.getHours() < hour) return false;
      if (this.storage.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [SUMMARY_SENT_KEY])?.value === JSON.stringify(today)) return false;
    }
    const { title, body } = summaryText(this.summary(now));
    this.storage.run(
      'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
      [SUMMARY_SENT_KEY, JSON.stringify(today), now.toISOString()],
    );
    await this.notify('summary', title, body);
    return true;
  }

  /** An application that stopped for you is gathered with others for a moment, then sent as one message. */
  private onEvent(e: AgentEvent): void {
    if (e.type !== AgentEventType.LOG || e.level !== 'warn' || !e.jobId) return;
    if (this.settings.get().agent.notifyNeedsYou === false) return;
    const job = this.storage.get<{ status: string; title: string; company: string; reason: string | null }>(
      'SELECT status, title, company, reason FROM jobs WHERE id = ?',
      [e.jobId],
    );
    if (!job || (job.status !== JobStatus.MANUAL && job.status !== JobStatus.NEEDS_INPUT)) return;
    const why = job.status === JobStatus.NEEDS_INPUT ? 'questions only you can answer' : /captcha/i.test(job.reason ?? '') ? 'a captcha to solve' : 'finish it by hand';
    this.waiting.set(e.jobId, { label: `${job.title} @ ${job.company}`, why });
    this.gatherTimer ??= setTimeout(() => {
      this.gatherTimer = null;
      const items = [...this.waiting.values()];
      this.waiting.clear();
      if (items.length) {
        const { title, body } = needsYouText(items);
        void this.notify('needs_you', title, body);
      }
    }, NEEDS_YOU_GATHER_MS);
    this.gatherTimer.unref?.();
  }
}
