import axios, { AxiosError } from 'axios';
import { Injectable, Logger } from '@nestjs/common';
import { parse } from 'node-html-parser';
import { decodeEntities, parseSearchCards } from '../utils/linkedin-guest.util';
import { jitter, sleep } from '../../../common/utils/sleep.util';
import { JobSource } from '../../jobs/enums/job-source.enum';
import { DiscoveredJob } from '../../jobs/interfaces/discovered-job.interface';
import {
  GUEST_HEADERS,
  LINKEDIN_GUEST_POSTING,
  LINKEDIN_GUEST_SEARCH,
  LINKEDIN_PAGE_SIZE,
} from '../constants/platform.constants';
import { DiscoverySource, SearchQuery } from '../interfaces/discovery-source.interface';
import { detectRemote } from '../utils/job-normalizer.util';

// LinkedIn's public guest endpoints: plain HTTP, so the user's account is never used for search.
@Injectable()
export class LinkedInSource implements DiscoverySource {
  readonly source = JobSource.LINKEDIN;
  private readonly logger = new Logger(LinkedInSource.name);

  async search(q: SearchQuery): Promise<DiscoveredJob[]> {
    const jobs = new Map<string, DiscoveredJob>();
    for (let start = 0; jobs.size < q.prefs.maxPerSearch; start += LINKEDIN_PAGE_SIZE) {
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
      if (cards.length === 0) break;
      for (const c of cards) jobs.set(c.externalId, c);
      q.onProgress(`LinkedIn: ${jobs.size} jobs for "${q.keyword}" in ${q.location}`);
      await jitter(700, 1600);
    }
    return [...jobs.values()].slice(0, q.prefs.maxPerSearch);
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
