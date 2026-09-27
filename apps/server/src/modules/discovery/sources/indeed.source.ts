// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable } from '@nestjs/common';
import { Page } from 'puppeteer-core';
import { jitter } from '../../../common/utils/sleep.util';
import { BrowserService } from '../../browser/browser.service';
import { JobSource } from '../../jobs/enums/job-source.enum';
import { JobPlatform } from '../../jobs/enums/job-platform.enum';
import { DiscoveredJob } from '../../jobs/interfaces/discovered-job.interface';
import { INDEED_CHALLENGE_WAIT_MS, INDEED_MAX_PAGES, INDEED_PAGE_DELAY_MS } from '../constants/platform.constants';
import { INDEED_CHALLENGE } from '../../apply/constants/apply.constants';
import { DiscoverySource, SearchQuery } from '../interfaces/discovery-source.interface';
import { IndeedCard } from '../interfaces/indeed-card.interface';
import { indeedCardToDiscovered, indeedSearchUrl } from '../utils/indeed.util';

/**
 * Indeed search in the agent's visible browser. The results are embedded in the
 * page itself, so each page is one normal page load - no extra requests.
 * Logged out, Indeed shows only the first page; logged in, it shows more.
 */
@Injectable()
export class IndeedSource implements DiscoverySource {
  readonly source = JobSource.INDEED;
  readonly platform = JobPlatform.INDEED;

  constructor(private readonly browser: BrowserService) {}

  search(q: SearchQuery): Promise<DiscoveredJob[]> {
    return this.browser.withPage(async (page) => {
      const jobs = new Map<string, DiscoveredJob>();
      let fresh = 0;
      for (let n = 0; n < INDEED_MAX_PAGES && fresh < q.prefs.maxPerSearch; n++) {
        if (n > 0) await jitter(...INDEED_PAGE_DELAY_MS);
        const cards = await this.readPage(page, indeedSearchUrl(q.keyword, q.location, q.prefs.postedWithinDays, n), q, n);
        if (!cards) break;
        const before = jobs.size;
        for (const job of cards.map(indeedCardToDiscovered).filter((j): j is DiscoveredJob => j !== null)) {
          if (!jobs.has(job.externalId) && !q.isKnown(job.externalId)) fresh++;
          jobs.set(job.externalId, job);
        }
        q.onProgress(`Indeed: checked ${jobs.size} listings, ${fresh} new so far ("${q.keyword}" in ${q.location})`);
        if (jobs.size === before) break;
      }
      return [...jobs.values()];
    });
  }

  /** One results page, or null when there are no more (or Indeed wants a login for more). */
  private async readPage(page: Page, url: string, q: SearchQuery, n: number): Promise<IndeedCard[] | null> {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => undefined);
    const state = await page
      .waitForFunction(
        () => {
          const w = window as unknown as { mosaic?: { providerData?: Record<string, unknown> } };
          if (w.mosaic?.providerData?.['mosaic-provider-jobcards']) return 'results';
          if (/secure\.indeed\.com\/auth|\/account\/login/.test(location.href)) return 'login';
          // A security check ("Just a moment...") usually clears by itself in a visible browser: keep waiting.
          return false;
        },
        { timeout: INDEED_CHALLENGE_WAIT_MS },
      )
      .then((h) => h.jsonValue() as Promise<string>)
      .catch(() => 'timeout');

    if (state === 'login') {
      if (n > 0) q.onProgress('Indeed: log in to Indeed in the agent browser to see more than the first page');
      return null;
    }
    if (state === 'timeout') {
      const text = await page.evaluate(() => document.title + ' ' + document.body.innerText.slice(0, 400)).catch(() => '');
      if (INDEED_CHALLENGE.test(text)) {
        throw new Error('Indeed is showing a security check - solve it in the agent browser window, or search again later');
      }
      throw new Error(`Indeed search did not load (stuck at ${page.url()})`);
    }
    return page.evaluate(() => {
      const w = window as unknown as { mosaic?: { providerData?: Record<string, { metaData?: { mosaicProviderJobCardsModel?: { results?: unknown[] } } }> } };
      return (w.mosaic?.providerData?.['mosaic-provider-jobcards']?.metaData?.mosaicProviderJobCardsModel?.results ?? []) as IndeedCard[];
    });
  }
}
