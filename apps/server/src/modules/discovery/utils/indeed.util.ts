// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { JobSource } from '../../jobs/enums/job-source.enum';
import { DiscoveredJob } from '../../jobs/interfaces/discovered-job.interface';
import { INDEED_FROMAGE_DAYS, INDEED_ORIGIN, INDEED_PAGE_STEP } from '../constants/platform.constants';
import { IndeedCard } from '../interfaces/indeed-card.interface';

/** Nearest "Date posted" choice Indeed offers, never shorter than asked. */
export const indeedFromage = (days: number): number => INDEED_FROMAGE_DAYS.find((d) => d >= days) ?? INDEED_FROMAGE_DAYS[INDEED_FROMAGE_DAYS.length - 1];

export function indeedSearchUrl(keyword: string, location: string, postedWithinDays: number, page: number): string {
  const params = new URLSearchParams({ q: keyword, l: /^(remote|work from home|wfh)$/i.test(location.trim()) ? 'Remote' : location.trim() });
  if (postedWithinDays > 0) params.set('fromage', String(indeedFromage(postedWithinDays)));
  if (page > 0) params.set('start', String(page * INDEED_PAGE_STEP));
  return `${INDEED_ORIGIN}/jobs?${params}`;
}

const text = (html: string | undefined): string =>
  (html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

export function indeedCardToDiscovered(c: IndeedCard): DiscoveredJob | null {
  if (!c.jobkey || c.expired) return null;
  return {
    source: JobSource.INDEED,
    externalId: c.jobkey,
    url: `${INDEED_ORIGIN}/viewjob?jk=${c.jobkey}`,
    title: text(c.displayTitle ?? c.title),
    company: text(c.company),
    location: c.formattedLocation ?? '',
    isRemote: c.remoteLocation === true || /remote|work from home/i.test(c.formattedLocation ?? ''),
    // "Easily apply" (Indeed Apply) versus "Apply on company site".
    easyApply: c.indeedApplyEnabled === true,
    salaryRaw: c.salarySnippet?.text || null,
    description: text(c.snippet),
    postedAt: c.pubDate ? new Date(c.pubDate).toISOString() : null,
  };
}
