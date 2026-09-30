// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Page } from 'puppeteer-core';
import { EventsService } from '../../common/events/events.service';
import { AgentEventType } from '../../common/events/enums/agent-event-type.enum';
import { sleep } from '../../common/utils/sleep.util';
import { BrowserService } from '../browser/browser.service';
import { JobSource } from '../jobs/enums/job-source.enum';
import { JobStatus } from '../jobs/enums/job-status.enum';
import { JobsService } from '../jobs/jobs.service';
import {
  APPLIED_LIST_WAIT_MS,
  APPLIED_MAX_SCROLLS,
  APPLIED_SCROLL_WAIT_MS,
  APPLIED_STABLE_SCROLLS,
  SIGN_IN_SETTLE_MS,
  CONFIRMED_ON_INDEED,
  INDEED_APPLIED_URL,
} from './constants/applied-sync.constants';
import { AppliedSyncResult } from './interfaces/applied-sync-result.interface';
import { indeedAppliedKeysInPage, indeedPageStateInPage } from './scripts/indeed-applied.script';

/**
 * Brings in applications the site knows about but Sudarshan missed - ones you finished by hand in a
 * tab it left open. It reads Indeed's own "My jobs -> Applied" list and marks exactly those jobs
 * (matched by Indeed's job id, never by title) as Applied. It only reads; it never clicks anything
 * on Indeed.
 */
@Injectable()
export class AppliedSyncService {
  private readonly logger = new Logger(AppliedSyncService.name);

  constructor(
    private readonly browser: BrowserService,
    private readonly jobs: JobsService,
    private readonly events: EventsService,
  ) {}

  async syncIndeed(): Promise<AppliedSyncResult> {
    await this.browser.ensure();
    if (!(await this.browser.isLoggedIn('indeed'))) {
      throw new BadRequestException('Log in to Indeed first (Settings, Site logins) - the list of your applications is only shown when you are logged in.');
    }
    const keys = await this.browser.withPage((page) => this.readAppliedKeys(page));
    return this.markApplied(keys);
  }

  /** Every job key on My jobs -> Applied, scrolling until the list stops growing. */
  private async readAppliedKeys(page: Page): Promise<string[]> {
    await page.goto(INDEED_APPLIED_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await this.waitForList(page);
    const keys = new Set<string>();
    let unchanged = 0;
    for (let i = 0; i < APPLIED_MAX_SCROLLS && unchanged < APPLIED_STABLE_SCROLLS; i++) {
      const before = keys.size;
      for (const k of (await page.evaluate(indeedAppliedKeysInPage)).keys) keys.add(k);
      unchanged = keys.size === before ? unchanged + 1 : 0;
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(APPLIED_SCROLL_WAIT_MS);
    }
    return [...keys];
  }

  /**
   * Waits for My jobs to settle: its list (or empty list) means go on. Indeed's sign-in form staying on
   * screen means you are really signed out - not the moment the page passes through Indeed's sign-in
   * address to check your session, which it does when you are logged in too.
   */
  private async waitForList(page: Page): Promise<void> {
    const deadline = Date.now() + APPLIED_LIST_WAIT_MS;
    let signInSince: number | null = null;
    while (Date.now() < deadline) {
      const state = await page.evaluate(indeedPageStateInPage).catch(() => 'loading' as const);
      if (state === 'list') return;
      if (state === 'signin') {
        signInSince ??= Date.now();
        if (Date.now() - signInSince >= SIGN_IN_SETTLE_MS) {
          throw new BadRequestException('Indeed is showing its sign-in page - log in to Indeed (Settings, Site logins), then check again.');
        }
      } else {
        signInSince = null;
      }
      await sleep(1000);
    }
    throw new BadRequestException("Could not read Indeed's list of your applications (the page did not finish loading) - try again in a moment.");
  }

  /** Marks the listed jobs Applied - at when Sudarshan last handed them to you, or when they were found. */
  markApplied(keys: string[]): AppliedSyncResult {
    const found = this.jobs.byExternalIds(JobSource.INDEED, keys);
    const result: AppliedSyncResult = { listed: keys.length, marked: [], alreadyApplied: 0, notInSudarshan: keys.length - found.length };
    for (const job of found) {
      if (job.status === JobStatus.APPLIED) {
        result.alreadyApplied++;
        continue;
      }
      if (this.jobs.markAppliedAt(job.id, CONFIRMED_ON_INDEED, job.lastAttempt ?? job.discoveredAt)) {
        result.marked.push({ id: job.id, title: job.title, company: job.company });
      }
    }
    const note = result.marked.length
      ? `Indeed lists ${result.listed} application(s): marked ${result.marked.length} as Applied that Sudarshan had missed`
      : `Indeed lists ${result.listed} application(s) - Sudarshan already had them all`;
    this.events.emit({ type: AgentEventType.LOG, level: result.marked.length ? 'success' : 'info', source: 'indeed', message: note });
    this.logger.log(note);
    return result;
  }
}
