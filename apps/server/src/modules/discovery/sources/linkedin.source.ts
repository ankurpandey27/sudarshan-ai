// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import axios, { AxiosError } from 'axios';
import { Injectable, Logger } from '@nestjs/common';
import { parse } from 'node-html-parser';
import { decodeEntities, parseSearchCards } from '../utils/linkedin-guest.util';
import { jitter, sleep } from '../../../common/utils/sleep.util';
import { JobSource } from '../../jobs/enums/job-source.enum';
import { JobPlatform } from '../../jobs/enums/job-platform.enum';
import { DiscoveredJob } from '../../jobs/interfaces/discovered-job.interface';
import { GUEST_HEADERS, LINKEDIN_GUEST_POSTING, LINKEDIN_GUEST_SEARCH, LINKEDIN_MAX_PAGES, LINKEDIN_PAGE_SIZE } from '../constants/platform.constants';
import { DiscoverySource, SearchQuery } from '../interfaces/discovery-source.interface';
import { detectRemote } from '../utils/job-normalizer.util';
import { anyOf } from '../utils/keywords.util';

// LinkedIn's public guest endpoints: plain HTTP, so the user's account is never used for search.
@Injectable()
export class LinkedInSource implements DiscoverySource {
  readonly source = JobSource.LINKEDIN;
  readonly platform = JobPlatform.LINKEDIN;
  private readonly logger = new Logger(LinkedInSource.name);
  // Public pages, no login: a few descriptions at once is safe.
  readonly enrichAtOnce = 3;

  /** LinkedIn search understands OR (checked live 2026-09-28: the combined results come from each keyword's). */
  combine(keywords: string[]): string {
    return anyOf(keywords);
  }

  async search(q: SearchQuery): Promise<DiscoveredJob[]> {
    const jobs = new Map<string, DiscoveredJob>();
    let fresh = 0;
    for (let page = 0; page < LINKEDIN_MAX_PAGES && fresh < q.prefs.maxPerSearch; page++) {
      const start = page * LINKEDIN_PAGE_SIZE;
      const params = new URLSearchParams({
        keywords: q.keyword,
        location: q.location,
        f_TPR: `r${q.prefs.postedWithinDays * 86_400}`,
        start: String(start),
      });
      if (q.prefs.easyApplyOnly) params.set('f_AL', 'true');
      if (q.prefs.remoteOnly || /^remote$/i.test(q.location)) params.set('f_WT', '2');
      if (/^remote$/i.test(q.location)) params.set('location', 'Worldwide');
      const html = await this.get(`${LINKEDIN_GUEST_SEARCH}?${params}`);
      if (!html) break;
      const remote = params.get('f_WT') === '2';
      // f_WT=2 is LinkedIn's remote filter.
      const cards = parseSearchCards(html, q.prefs.easyApplyOnly).map((c) => (remote ? { ...c, isRemote: true } : c));
      const before = jobs.size;
      for (const c of cards) {
        if (!jobs.has(c.externalId) && !q.isKnown(c.externalId)) fresh++;
        jobs.set(c.externalId, c);
      }
      // Past the last result LinkedIn repeats earlier cards.
      if (jobs.size === before) break;
      q.onProgress(`LinkedIn: checked ${jobs.size} listings, ${fresh} new so far ("${q.keyword}" in ${q.location})`);
      await jitter(700, 1600);
    }
    return [...jobs.values()];
  }

  async enrich(job: DiscoveredJob): Promise<DiscoveredJob> {
    const html = await this.get(`${LINKEDIN_GUEST_POSTING}/${job.externalId}`);
    if (!html) return job;
    const root = parse(html);
    const description = root.querySelector('.show-more-less-html__markup, .description__text')?.innerText?.trim() ?? '';
    const criteria = root
      .querySelectorAll('.description__job-criteria-item')
      .map((el) => `${el.querySelector('h3')?.innerText.trim()}: ${el.querySelector('span')?.innerText.trim()}`)
      .join('\n');
    const applyText = root.querySelector('.top-card-layout__cta-container, .apply-button')?.innerText ?? '';
    return {
      ...job,
      description: [decodeEntities(description), criteria].filter(Boolean).join('\n\n') || job.description,
      easyApply: job.easyApply || /easy apply/i.test(applyText),
      isRemote: job.isRemote || detectRemote(job.location, description),
    };
  }

  private async get(url: string, attempt = 0): Promise<string | null> {
    try {
      const { data } = await axios.get<string>(url, { headers: GUEST_HEADERS, timeout: 20_000, responseType: 'text' });
      return data;
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      if (status === 429 && attempt < 3) {
        // Guest endpoints throttle bursts.
        await sleep(5000 * 2 ** attempt);
        return this.get(url, attempt + 1);
      }
      if (status === 400 || status === 404) return null;
      this.logger.warn(`LinkedIn guest request failed (${status ?? (err as Error).message})`);
      return null;
    }
  }
}
