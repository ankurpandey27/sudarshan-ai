// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable, Logger, Optional } from '@nestjs/common';
import { EventsService } from '../../common/events/events.service';
import { AgentEventType } from '../../common/events/enums/agent-event-type.enum';
import { jitter } from '../../common/utils/sleep.util';
import { inBatches } from '../../common/utils/batches.util';
import { MAX_COMBINED_PER_SEARCH, MAX_ENRICH_PER_SEARCH } from './constants/platform.constants';
import { JobsService } from '../jobs/jobs.service';
import { ProfileService } from '../profile/profile.service';
import { SettingsService } from '../settings/settings.service';
import { BrowserService } from '../browser/browser.service';
import { DiscoveryRunResult, DiscoverySource } from './interfaces/discovery-source.interface';
import { LinkedInSource } from './sources/linkedin.source';
import { NaukriSource } from './sources/naukri.source';
import { InstahyreSource } from './sources/instahyre.source';
import { FounditSource } from './sources/foundit.source';
import { HiristSource } from './sources/hirist.source';
import { IndeedSource } from './sources/indeed.source';
import { JobPlatform } from '../jobs/enums/job-platform.enum';
import { sourceLabel } from '../jobs/utils/source-label.util';

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);
  private readonly sources: DiscoverySource[];
  private running = false;

  constructor(
    linkedin: LinkedInSource,
    naukri: NaukriSource,
    instahyre: InstahyreSource,
    indeed: IndeedSource,
    private readonly jobs: JobsService,
    private readonly settings: SettingsService,
    private readonly profile: ProfileService,
    private readonly browser: BrowserService,
    private readonly events: EventsService,
    @Optional() foundit?: FounditSource,
    @Optional() hirist?: HiristSource,
  ) {
    const all: (DiscoverySource | undefined)[] = [linkedin, naukri, instahyre, indeed, foundit, hirist];
    this.sources = all.filter((src): src is DiscoverySource => !!src);
  }

  isRunning(): boolean {
    return this.running;
  }

  // Falls back to the current title when no keywords are set.
  keywords(): string[] {
    const s = this.settings.get().search;
    if (s.keywords.length) return s.keywords;
    const p = this.profile.get();
    return [p.currentTitle || p.headline].filter((k): k is string => !!k).slice(0, 1);
  }

  async run(only?: JobPlatform[]): Promise<DiscoveryRunResult[]> {
    if (this.running) return [];
    this.running = true;
    try {
      const s = this.settings.get();
      const keywords = this.keywords();
      if (keywords.length === 0) {
        this.log('warn', 'Add search keywords in Settings (or upload a resume with a job title) to find jobs');
        return [];
      }
      // The "Apply on" switches decide which platforms are searched.
      const on: Record<JobPlatform, boolean> = {
        [JobPlatform.LINKEDIN]: s.sources.linkedin.enabled,
        [JobPlatform.NAUKRI]: s.sources.naukri.enabled,
        [JobPlatform.INSTAHYRE]: s.sources.instahyre.enabled,
        [JobPlatform.INDEED]: s.sources.indeed.enabled,
        [JobPlatform.FOUNDIT]: s.sources.foundit?.enabled === true,
        [JobPlatform.HIRIST]: s.sources.hirist?.enabled === true,
        [JobPlatform.OTHER]: false,
      };
      const enabled = this.sources.filter((src) => (!only || only.includes(src.platform)) && on[src.platform]);
      if (enabled.length === 0) {
        this.log('warn', 'Every platform that can be searched is switched off - turn one on under "Apply on"');
        return [];
      }
      return await Promise.all(enabled.map((src) => this.runSource(src, keywords, s.search.locations.length ? s.search.locations : ['India'])));
    } finally {
      this.running = false;
    }
  }

  private async runSource(src: DiscoverySource, keywords: string[], locations: string[]): Promise<DiscoveryRunResult> {
    const result: DiscoveryRunResult = { source: src.source, found: 0, added: 0 };
    const prefs = this.settings.get().search;
    try {
      if (src.platform !== JobPlatform.LINKEDIN) await this.browser.ensure();
      // Sites that understand "any of these words" get one search per location, not one per keyword -
      // with room for as many new jobs as the separate searches would have found.
      const combined = src.combine && keywords.length > 1;
      const queries = combined ? [src.combine!(keywords)] : keywords;
      const perSearch = combined ? Math.min(prefs.maxPerSearch * keywords.length, MAX_COMBINED_PER_SEARCH) : prefs.maxPerSearch;
      for (const keyword of queries) {
        for (const location of locations) {
          const found = await src.search({
            keyword,
            location,
            prefs: { ...prefs, maxPerSearch: perSearch },
            isKnown: (id) => this.jobs.knownExternalIds(src.source, [id]).size > 0,
            onProgress: (m) => this.log('info', m, src.platform),
          });
          result.found += found.length;
          const known = this.jobs.knownExternalIds(
            src.source,
            found.map((f) => f.externalId),
          );
          result.added += this.jobs.saveDiscovered(found).length;
          // Fetch full descriptions only for jobs not seen before.
          const fresh = found.filter((f) => !f.description && !known.has(f.externalId));
          if (src.enrich && fresh.length) {
            const enrich = src.enrich.bind(src);
            // A few at a time where the site allows it (LinkedIn's public pages); one by one otherwise.
            await inBatches(fresh.slice(0, MAX_ENRICH_PER_SEARCH * (combined ? keywords.length : 1)), src.enrichAtOnce ?? 1, async (job) => {
              this.jobs.saveDiscovered([await enrich(job)]);
              await jitter(500, 1200);
            });
          }
        }
      }
      const seen = result.found - result.added;
      this.log(
        'success',
        `${sourceLabel(src.platform)}: ${result.found} unique jobs, ${result.added} new` + (seen ? ` (${seen} already in your list)` : ''),
        src.platform,
      );
      this.events.emit({ type: AgentEventType.JOBS_DISCOVERED, message: `${result.added} new jobs`, source: src.platform, data: { ...result } });
    } catch (err) {
      result.error = (err as Error).message;
      this.log('error', `${sourceLabel(src.platform)} search failed: ${result.error}`, src.platform);
    }
    return result;
  }

  private log(level: 'info' | 'warn' | 'error' | 'success', message: string, source?: string): void {
    this.events.emit({ type: AgentEventType.LOG, level, message, source });
  }
}
