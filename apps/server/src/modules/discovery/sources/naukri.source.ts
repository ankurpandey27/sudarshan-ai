// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable, Logger } from '@nestjs/common';
import { HTTPResponse, Page } from 'puppeteer-core';
import { jitter } from '../../../common/utils/sleep.util';
import { BrowserService } from '../../browser/browser.service';
import { JobSource } from '../../jobs/enums/job-source.enum';
import { JobPlatform } from '../../jobs/enums/job-platform.enum';
import { DiscoveredJob } from '../../jobs/interfaces/discovered-job.interface';
import { NAUKRI_MAX_PAGES, NAUKRI_SEARCH_API } from '../constants/platform.constants';
import { DiscoverySource, SearchQuery } from '../interfaces/discovery-source.interface';
import { NaukriSearchResponse } from '../interfaces/naukri-api.interface';
import { naukriJobToDiscovered, slug } from '../utils/naukri.util';
import { detectRemote } from '../utils/job-normalizer.util';

/**
 * Naukri blocks plain HTTP clients, so search runs in the browser and reads the
 * JSON of the page's own /jobapi search request. DOM scraping is the fallback.
 */
@Injectable()
export class NaukriSource implements DiscoverySource {
  readonly source = JobSource.NAUKRI;
  readonly platform = JobPlatform.NAUKRI;
  private readonly logger = new Logger(NaukriSource.name);

  constructor(private readonly browser: BrowserService) {}

  search(q: SearchQuery): Promise<DiscoveredJob[]> {
    return this.browser.withPage(async (page) => {
      const jobs = new Map<string, DiscoveredJob>();
      let fresh = 0;
      for (let n = 1; n <= NAUKRI_MAX_PAGES && fresh < q.prefs.maxPerSearch; n++) {
        const found = await this.searchPage(page, q, n);
        const before = jobs.size;
        for (const j of found) {
          if (!jobs.has(j.externalId) && !q.isKnown(j.externalId)) fresh++;
          jobs.set(j.externalId, j);
        }
        if (jobs.size === before) break;
        q.onProgress(`Naukri: checked ${jobs.size} listings, ${fresh} new so far ("${q.keyword}" in ${q.location})`);
        await jitter(1200, 2500);
      }
      return [...jobs.values()];
    });
  }

  private async searchPage(page: Page, q: SearchQuery, n: number): Promise<DiscoveredJob[]> {
    const remote = /^remote$/i.test(q.location);
    const loc = remote ? '' : q.location;
    const base = loc ? `${slug(q.keyword)}-jobs-in-${slug(loc)}` : `${slug(q.keyword)}-jobs`;
    const params = new URLSearchParams({ k: q.keyword, ...(loc ? { l: loc } : {}), jobAge: String(q.prefs.postedWithinDays) });
    if (remote || q.prefs.remoteOnly) params.set('wfhType', '2');
    const url = `https://www.naukri.com/${base}${n > 1 ? `-${n}` : ''}?${params}`;

    const apiResponse = new Promise<NaukriSearchResponse | null>((resolve) => {
      const timer = setTimeout(() => {
        page.off('response', onResponse);
        resolve(null);
      }, 20_000);
      const onResponse = (res: HTTPResponse) => {
        if (!NAUKRI_SEARCH_API.test(res.url()) || res.request().method() !== 'GET') return;
        res
          .json()
          .then((body: NaukriSearchResponse) => {
            clearTimeout(timer);
            page.off('response', onResponse);
            resolve(body);
          })
          .catch(() => undefined);
      };
      page.on('response', onResponse);
    });
    await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => undefined);
    const body = await apiResponse;
    if (body?.jobDetails) return body.jobDetails.map(naukriJobToDiscovered).filter((j): j is DiscoveredJob => j !== null);

    this.logger.warn('Naukri search API not observed - falling back to reading the page');
    return this.scrapeCards(page);
  }

  private async scrapeCards(page: Page): Promise<DiscoveredJob[]> {
    await page.waitForSelector('.srp-jobtuple-wrapper, .cust-job-tuple, article.jobTuple', { timeout: 10_000 }).catch(() => undefined);
    const cards = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.srp-jobtuple-wrapper, .cust-job-tuple, article.jobTuple')).map((c) => {
        const a = c.querySelector('a.title, a[href*="job-listings"]') as HTMLAnchorElement | null;
        const t = (sel: string) => (c.querySelector(sel) as HTMLElement | null)?.innerText?.trim() ?? '';
        return {
          href: a?.href ?? '',
          title: a?.innerText?.trim() ?? '',
          company: t('.comp-name, .subTitle, .company-name'),
          location: t('.locWdth, .loc, [class*="location"]'),
          salary: t('.sal, [class*="salary"]'),
          text: (c as HTMLElement).innerText.slice(0, 2000),
        };
      }),
    );
    return cards
      .map((c): DiscoveredJob | null => {
        const id = /(\d{9,})/.exec(c.href)?.[1];
        if (!id) return null;
        return {
          source: JobSource.NAUKRI,
          externalId: id,
          url: c.href,
          title: c.title,
          company: c.company,
          location: c.location,
          isRemote: detectRemote(c.location, c.text),
          easyApply: true,
          salaryRaw: c.salary || null,
          description: c.text,
        };
      })
      .filter((j): j is DiscoveredJob => j !== null);
  }
}
