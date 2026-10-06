// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'puppeteer-core';
import { jitter, sleep } from '../../../common/utils/sleep.util';
import { BrowserService } from '../../browser/browser.service';
import { JobSource } from '../../jobs/enums/job-source.enum';
import { JobPlatform } from '../../jobs/enums/job-platform.enum';
import { DiscoveredJob } from '../../jobs/interfaces/discovered-job.interface';
import { ProfileService } from '../../profile/profile.service';
import { INSTAHYRE_BACKOFF_MS, INSTAHYRE_MAX_PAGES, INSTAHYRE_ORIGIN, INSTAHYRE_PAGE_DELAY_MS, INSTAHYRE_PAGE_SIZE, INSTAHYRE_WARMUP_PATH } from '../constants/platform.constants';
import { DiscoverySource, SearchQuery } from '../interfaces/discovery-source.interface';
import { InstahyreSearchResponse } from '../interfaces/instahyre-api.interface';
import { instahyreJobToDiscovered, instahyreSearchPath } from '../utils/instahyre.util';

/**
 * Instahyre sits behind Cloudflare, which turns away plain HTTP and headless
 * browsers, so search runs in the agent's visible browser on Instahyre's own
 * search page and reads the same JSON that page uses. Slowly: Instahyre
 * rate-limits quick requests.
 */
@Injectable()
export class InstahyreSource implements DiscoverySource {
  readonly source = JobSource.WEB;
  readonly platform = JobPlatform.INSTAHYRE;
  private readonly logger = new Logger(InstahyreSource.name);

  constructor(
    private readonly browser: BrowserService,
    private readonly profile: ProfileService,
  ) {}

  search(q: SearchQuery): Promise<DiscoveredJob[]> {
    return this.browser.withPage(async (page) => {
      await this.open(page);
      const years = this.profile.get().totalYearsExperience;
      const jobs = new Map<string, DiscoveredJob>();
      let fresh = 0;
      for (let n = 0; n < INSTAHYRE_MAX_PAGES && fresh < q.prefs.maxPerSearch; n++) {
        if (n > 0) await jitter(...INSTAHYRE_PAGE_DELAY_MS);
        const res = await this.fetchPage(page, instahyreSearchPath(q.keyword, q.location, years, n));
        const found = (res?.objects ?? []).map(instahyreJobToDiscovered).filter((j): j is DiscoveredJob => j !== null);
        const before = jobs.size;
        for (const j of found) {
          if (!jobs.has(j.externalId) && !q.isKnown(j.externalId)) fresh++;
          jobs.set(j.externalId, j);
        }
        q.onProgress(`Instahyre: checked ${jobs.size} listings, ${fresh} new so far ("${q.keyword}" in ${q.location})`);
        if (jobs.size === before || found.length < INSTAHYRE_PAGE_SIZE || !res?.meta?.next) break;
      }
      return [...jobs.values()];
    });
  }

  /**
   * Gets the tab onto instahyre.com, which is all the search needs. A small JSON
   * address loads in seconds; the search-jobs page takes 30s+ to finish loading.
   */
  private async open(page: Page): Promise<void> {
    await page.goto(`${INSTAHYRE_ORIGIN}${INSTAHYRE_WARMUP_PATH}`, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => undefined);
    // Cloudflare's check page ("Just a moment...") clears by itself in a normal browser, then the JSON shows.
    const passed = await page
      .waitForFunction(() => (document.body?.innerText ?? '').trim().startsWith('{'), { timeout: 45_000 })
      .then(() => true)
      .catch(() => false);
    if (passed) return;
    const where = `${page.url()} "${await page.title().catch(() => '')}"`;
    if (/just a moment|security verification|attention required/i.test(await page.evaluate(() => document.title + document.body.innerText.slice(0, 300)).catch(() => ''))) {
      throw new Error(`Instahyre's security check did not pass (${where}). Turn off "Hide the browser window" in Settings - Instahyre only opens in a visible browser.`);
    }
    throw new Error(`Instahyre did not open in time (stuck at ${where})`);
  }

  private async fetchPage(page: Page, path: string): Promise<InstahyreSearchResponse | null> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await page.evaluate(async (p: string) => {
        const response = await fetch(p, { headers: { accept: 'application/json' } });
        return { status: response.status, body: response.ok ? ((await response.json()) as unknown) : null };
      }, path);
      if (res.status === 429 && attempt === 0) {
        this.logger.warn('Instahyre asked to slow down - waiting a minute');
        await sleep(INSTAHYRE_BACKOFF_MS);
        continue;
      }
      if (res.status !== 200) throw new Error(`Instahyre search answered ${res.status}`);
      return res.body as InstahyreSearchResponse;
    }
    throw new Error('Instahyre is limiting requests right now - it will be searched again next time');
  }
}
