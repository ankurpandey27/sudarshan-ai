// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable } from '@nestjs/common';
import { Page } from 'puppeteer-core';
import { jitter, sleep } from '../../../common/utils/sleep.util';
import { BrowserService } from '../../browser/browser.service';
import { JobSource } from '../../jobs/enums/job-source.enum';
import { JobPlatform } from '../../jobs/enums/job-platform.enum';
import { DiscoveredJob } from '../../jobs/interfaces/discovered-job.interface';
import { FOUNDIT_DENIED_RETRY_MS, FOUNDIT_MAX_PAGES, FOUNDIT_ORIGIN, FOUNDIT_PAGE_DELAY_MS, FOUNDIT_PAGE_SIZE } from '../constants/platform.constants';
import { DiscoverySource, SearchQuery } from '../interfaces/discovery-source.interface';
import { FounditSearchResponse } from '../interfaces/portal-api.interface';
import { founditJobToDiscovered, founditSearchPath, inPlace } from '../utils/portals.util';

/**
 * Foundit (formerly Monster India). Its search answers only inside a real browser on foundit.in, so it runs in the
 * agent's visible browser and reads the same JSON Foundit's own search page uses. Listings that only point to
 * LinkedIn are left to the LinkedIn search; ones that point to a company site become that site's jobs.
 */
@Injectable()
export class FounditSource implements DiscoverySource {
  readonly source = JobSource.WEB;
  readonly platform = JobPlatform.FOUNDIT;

  constructor(private readonly browser: BrowserService) {}

  search(q: SearchQuery): Promise<DiscoveredJob[]> {
    return this.browser.withPage(async (page) => {
      await this.open(page);
      const jobs = new Map<string, DiscoveredJob>();
      let fresh = 0;
      for (let n = 0; n < FOUNDIT_MAX_PAGES && fresh < q.prefs.maxPerSearch; n++) {
        if (n > 0) await jitter(...FOUNDIT_PAGE_DELAY_MS);
        const res = await this.fetchPage(page, founditSearchPath(q.keyword, q.location, n));
        const list = res.jobSearchResponse?.data ?? [];
        for (const raw of list) {
          const j = founditJobToDiscovered(raw);
          if (!j || !inPlace(q.location, j.location, j.isRemote) || jobs.has(j.externalId)) continue;
          if (!q.isKnown(j.externalId)) fresh++;
          jobs.set(j.externalId, j);
        }
        q.onProgress(`Foundit: checked ${(n + 1) * FOUNDIT_PAGE_SIZE} listings, ${fresh} new so far ("${q.keyword}" in ${q.location})`);
        if (list.length < FOUNDIT_PAGE_SIZE) break;
      }
      return [...jobs.values()];
    });
  }

  /**
   * Gets the tab onto foundit.in. Foundit's bot shield sometimes turns a browser away for a short while (after many
   * quick visits, 2026-10-02) - it is tried again once after a pause, then left for the next search.
   */
  private async open(page: Page): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await sleep(FOUNDIT_DENIED_RETRY_MS);
      if (attempt > 0 || !page.url().startsWith(FOUNDIT_ORIGIN)) await page.goto(FOUNDIT_ORIGIN, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      if (!/access denied/i.test(await page.title().catch(() => ''))) return;
    }
    const hidden = this.browser.isHeadless();
    throw new Error(
      hidden
        ? 'Foundit turned the browser away ("Access Denied"). Turn off "Hide the browser window" in Settings - Foundit opens only in a visible browser.'
        : 'Foundit turned the browser away for now ("Access Denied") - it is searched again next time.',
    );
  }

  private async fetchPage(page: Page, path: string): Promise<FounditSearchResponse> {
    let res: { status: number; body: unknown } | null = null;
    // Foundit sometimes redirects the tab while it is being read ("Execution context was destroyed", 2026-10-03):
    // once it has settled, read again.
    for (let attempt = 0; !res; attempt++) {
      try {
        res = await page.evaluate(async (p: string) => {
          const response = await fetch(p, { headers: { accept: 'application/json' } });
          return { status: response.status, body: response.ok ? ((await response.json()) as unknown) : null };
        }, path);
      } catch (err) {
        if (attempt >= 2 || !/context was destroyed|navigation|detached/i.test((err as Error).message)) throw err;
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => undefined);
        if (!page.url().startsWith(FOUNDIT_ORIGIN)) await this.open(page);
      }
    }
    if (res.status !== 200) throw new Error(`Foundit search answered ${res.status}`);
    return res.body as FounditSearchResponse;
  }
}
