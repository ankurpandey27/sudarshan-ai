// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import axios from 'axios';
import { Injectable } from '@nestjs/common';
import { jitter } from '../../../common/utils/sleep.util';
import { JobSource } from '../../jobs/enums/job-source.enum';
import { JobPlatform } from '../../jobs/enums/job-platform.enum';
import { DiscoveredJob } from '../../jobs/interfaces/discovered-job.interface';
import { ProfileService } from '../../profile/profile.service';
import { HIMALAYAS_MAX_PAGES, HIMALAYAS_PAGE_DELAY_MS, HIMALAYAS_PAGE_SIZE } from '../constants/platform.constants';
import { DiscoverySource, SearchQuery } from '../interfaces/discovery-source.interface';
import { HimalayasSearchResponse } from '../interfaces/portal-api.interface';
import { himalayasJobToDiscovered, himalayasSearchUrl } from '../utils/portals.util';

/**
 * Himalayas: remote jobs, through its public jobs API - only jobs open to people in your country (from your profile,
 * India when it is not set). Every job is remote, so it is searched once per keyword, not once per city. Applying
 * needs a Himalayas login (Settings -> Site logins).
 */
@Injectable()
export class HimalayasSource implements DiscoverySource {
  readonly source = JobSource.WEB;
  readonly platform = JobPlatform.HIMALAYAS;

  constructor(private readonly profile: ProfileService) {}

  async search(q: SearchQuery): Promise<DiscoveredJob[]> {
    // Remote jobs: the same for every city searched - once, with the first place.
    const places = q.prefs.locations.length ? q.prefs.locations : ['India'];
    if (q.location !== places[0]) return [];
    const country = this.profile.get().country?.trim() || 'India';
    const jobs = new Map<string, DiscoveredJob>();
    let fresh = 0;
    for (let page = 1; page <= HIMALAYAS_MAX_PAGES && fresh < q.prefs.maxPerSearch; page++) {
      if (page > 1) await jitter(...HIMALAYAS_PAGE_DELAY_MS);
      const res = await axios.get<HimalayasSearchResponse>(himalayasSearchUrl(q.keyword, country, page), {
        timeout: 20_000,
        headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36' },
      });
      const list = res.data?.jobs ?? [];
      for (const raw of list) {
        const j = himalayasJobToDiscovered(raw);
        if (!j || jobs.has(j.externalId)) continue;
        if (!q.isKnown(j.externalId)) fresh++;
        jobs.set(j.externalId, j);
      }
      q.onProgress(`Himalayas: checked ${page * HIMALAYAS_PAGE_SIZE} remote listings open to ${country}, ${fresh} new so far ("${q.keyword}")`);
      if (list.length < HIMALAYAS_PAGE_SIZE - 1) break;
    }
    return [...jobs.values()];
  }
}
