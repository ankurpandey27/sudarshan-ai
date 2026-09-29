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
  CONFIRMED_ON_INDEED,
  INDEED_APPLIED_URL,
} from './constants/applied-sync.constants';
import { AppliedSyncResult } from './interfaces/applied-sync-result.interface';
import { indeedAppliedKeysInPage, indeedSignInShownInPage } from './scripts/indeed-applied.script';

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
    if (await page.evaluate(indeedSignInShownInPage)) {
      throw new BadRequestException('Indeed asked you to sign in again - log in to Indeed (Settings, Site logins), then check again.');
    }
    // The list is drawn after the page loads; an empty list is fine too.
    await page
      .waitForFunction(
        () => /\bapplied\b[^\n]{0,60}\bon indeed\b/i.test(document.body?.innerText ?? '') || /no (applications|jobs)/i.test(document.body?.innerText ?? ''),
        {
          timeout: APPLIED_LIST_WAIT_MS,
        },
      )
      .catch(() => undefined);
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
