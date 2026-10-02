// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import axios from 'axios';
import { Injectable } from '@nestjs/common';
import { jitter } from '../../../common/utils/sleep.util';
import { JobSource } from '../../jobs/enums/job-source.enum';
import { JobPlatform } from '../../jobs/enums/job-platform.enum';
import { DiscoveredJob } from '../../jobs/interfaces/discovered-job.interface';
import { HIRIST_MAX_PAGES, HIRIST_PAGE_DELAY_MS, HIRIST_PAGE_SIZE } from '../constants/platform.constants';
import { DiscoverySource, SearchQuery } from '../interfaces/discovery-source.interface';
import { HiristSearchResponse } from '../interfaces/portal-api.interface';
import { hiristJobToDiscovered, hiristSearchUrl, inPlace } from '../utils/portals.util';

/**
 * Hirist (tech jobs in India) over its public search API, the data its own search page loads - no browser and no
 * login needed to search. Applying on Hirist needs you logged in there (Settings -> Site logins).
 */
@Injectable()
export class HiristSource implements DiscoverySource {
  readonly source = JobSource.WEB;
  readonly platform = JobPlatform.HIRIST;

  async search(q: SearchQuery): Promise<DiscoveredJob[]> {
    const jobs = new Map<string, DiscoveredJob>();
    let fresh = 0;
    for (let page = 0; page < HIRIST_MAX_PAGES && fresh < q.prefs.maxPerSearch; page++) {
      if (page > 0) await jitter(...HIRIST_PAGE_DELAY_MS);
      const res = await axios.get<HiristSearchResponse>(hiristSearchUrl(q.keyword, page), {
        timeout: 20_000,
        headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36' },
      });
      const list = res.data?.data ?? [];
      for (const raw of list) {
        const j = hiristJobToDiscovered(raw);
        if (!j || !inPlace(q.location, j.location, j.isRemote) || jobs.has(j.externalId)) continue;
        if (!q.isKnown(j.externalId)) fresh++;
        jobs.set(j.externalId, j);
      }
      q.onProgress(`Hirist: checked ${(page + 1) * HIRIST_PAGE_SIZE} listings, ${fresh} new so far ("${q.keyword}" in ${q.location})`);
      if (list.length < HIRIST_PAGE_SIZE) break;
    }
    return [...jobs.values()];
  }
}
