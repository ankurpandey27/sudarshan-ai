// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { isHostOf } from '../../jobs/utils/host.util';
import { DiscoveredJob } from '../../jobs/interfaces/discovered-job.interface';
import { parseJobUrl } from '../../jobs/utils/job-url.util';
import { FOUNDIT_ORIGIN, FOUNDIT_PAGE_SIZE, HIMALAYAS_SEARCH_API, HIRIST_PAGE_SIZE, HIRIST_SEARCH_API } from '../constants/platform.constants';
import { parse } from 'node-html-parser';
import { FounditJob, HimalayasJob, HiristJob } from '../interfaces/portal-api.interface';
import { extractSkills } from './job-normalizer.util';

const REMOTE = /^(remote|work from home|wfh)$/i;
/** Cities with two names in job posts. */
const SAME_CITY: string[][] = [
  ['bangalore', 'bengaluru'],
  ['gurgaon', 'gurugram'],
  ['bombay', 'mumbai'],
  ['delhi', 'new delhi', 'delhi ncr', 'ncr'],
];
/** Cities of the Delhi region: jobs posted for "Delhi NCR" are in them too. */
const NCR = ['noida', 'greater noida', 'gurgaon', 'gurugram', 'delhi', 'new delhi', 'ghaziabad', 'faridabad'];

/** Whether a job's locations are in the place you search ("India" is everywhere; "Remote" is work from home). */
export function inPlace(place: string, locations: string, remote: boolean): boolean {
  const p = place.trim().toLowerCase();
  if (!p || p === 'india') return true;
  if (REMOTE.test(p)) return remote || /remote|work from home|wfh/i.test(locations);
  const names = SAME_CITY.find((g) => g.includes(p)) ?? [p];
  const l = locations.toLowerCase();
  return names.some((n) => l.includes(n)) || (NCR.includes(p) && /\bncr\b/.test(l));
}

export function founditSearchPath(keyword: string, location: string, page: number): string {
  const q = new URLSearchParams({ sort: '1', limit: String(FOUNDIT_PAGE_SIZE), start: String(page * FOUNDIT_PAGE_SIZE), query: keyword });
  const place = REMOTE.test(location.trim()) ? 'Work From Home' : location.trim();
  if (place && !/^india$/i.test(place)) q.set('locations', place);
  return `/middleware/jobsearch?${q}`;
}

/**
 * A Foundit listing as a job. Many only point to a LinkedIn job (Sudarshan's LinkedIn search finds those itself,
 * with LinkedIn's own apply) - skipped; one that points to a company's career site becomes that site's job.
 */
export function founditJobToDiscovered(j: FounditJob | null): DiscoveredJob | null {
  if (!j?.title || !j.jobId) return null;
  const redirect = j.redirectUrl?.trim() ?? '';
  let host = '';
  try {
    host = redirect ? new URL(redirect).hostname : '';
  } catch {
    return null;
  }
  if (redirect && isHostOf(host, 'linkedin.com')) return null;
  const page = j.seoJdUrl || j.jdUrl;
  const parsed = parseJobUrl(redirect || (page ? `${FOUNDIT_ORIGIN}${page}` : ''));
  if (!parsed) return null;
  const skills = (j.skills ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const min = j.minimumSalary?.absoluteValue ?? 0;
  const max = j.maximumSalary?.absoluteValue ?? 0;
  return {
    source: parsed.source,
    externalId: parsed.externalId,
    url: parsed.url,
    title: j.title.trim(),
    company: j.hideCompanyName ? '' : (j.companyName ?? '').trim(),
    location: j.locations ?? '',
    isRemote: /work from home|remote/i.test(j.locations ?? ''),
    easyApply: false,
    salaryMin: !j.hideSalary && min > 0 ? min : null,
    salaryMax: !j.hideSalary && max > 0 ? max : null,
    description: [skills.length && `Skills: ${skills.join(', ')}`, j.exp && `Experience: ${j.exp}`].filter(Boolean).join('\n'),
    skills,
    postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
  };
}

/**
 * Hirist matches its skill tags as written: "node.js" finds 20+ jobs, "nodejs" or "node js" one or none (2026-10-02).
 * A keyword that is a known skill is searched by its usual name.
 */
export function hiristQuery(keyword: string): string {
  const skills = extractSkills(keyword);
  return skills.length === 1 && keyword.trim().split(/\s+/).length <= 2 ? skills[0] : keyword.trim();
}

export function hiristSearchUrl(keyword: string, page: number): string {
  const q = new URLSearchParams({ query: hiristQuery(keyword), page: String(page), posting: '0', industry: '', size: String(HIRIST_PAGE_SIZE) });
  return `${HIRIST_SEARCH_API}?${q}`;
}

/** A Hirist job as a job; one that sends you to a company site is that site's job. */
export function hiristJobToDiscovered(j: HiristJob): DiscoveredJob | null {
  if (!j?.title || !j.id) return null;
  const own = j.applyUrl?.trim() && /^https?:\/\//i.test(j.applyUrl) && !/hirist\./i.test(j.applyUrl) ? j.applyUrl.trim() : '';
  const parsed = parseJobUrl(own || j.jobDetailUrl || '');
  if (!parsed) return null;
  const skills = (j.tags ?? []).map((t) => t.name).filter(Boolean);
  const location = (j.locations ?? []).map((l) => l.name).join(', ');
  return {
    source: parsed.source,
    externalId: parsed.externalId,
    url: parsed.url,
    title: j.title.trim(),
    company: (j.companyData?.companyName ?? '').trim(),
    location,
    isRemote: j.workFromHome === 1,
    easyApply: false,
    // Hirist's salary fields have no stated unit (and are mostly hidden): left out rather than guessed.
    description: [skills.length && `Skills: ${skills.join(', ')}`, j.max !== undefined && `Experience: ${j.min ?? 0}-${j.max} years`].filter(Boolean).join('\n'),
    skills,
    postedAt: j.createdTime ? new Date(j.createdTime).toISOString() : null,
  };
}

export function himalayasSearchUrl(keyword: string, country: string, page: number): string {
  const q = new URLSearchParams({ q: keyword.trim(), country, page: String(page) });
  return `${HIMALAYAS_SEARCH_API}?${q}`;
}

/** A Himalayas job: always remote, open to the countries it lists; an expired one is skipped. */
export function himalayasJobToDiscovered(j: HimalayasJob, now = Date.now()): DiscoveredJob | null {
  if (!j?.title) return null;
  if (j.expiryDate && j.expiryDate * 1000 < now) return null;
  const parsed = parseJobUrl(j.applicationLink || j.guid || '');
  if (!parsed) return null;
  const where = j.locationRestrictions?.length ? j.locationRestrictions.slice(0, 5).join(', ') : 'Anywhere';
  const text = j.description ? parse(j.description).structuredText : (j.excerpt ?? '');
  const pay = j.minSalary || j.maxSalary ? `${j.currency ?? ''} ${j.minSalary ?? ''}-${j.maxSalary ?? ''} ${j.salaryPeriod ?? ''}`.replace(/\s+/g, ' ').trim() : null;
  return {
    source: parsed.source,
    externalId: parsed.externalId,
    url: parsed.url,
    title: j.title.trim(),
    company: (j.companyName ?? '').trim(),
    location: `Remote (${where})`,
    isRemote: true,
    easyApply: false,
    salaryRaw: pay,
    description: text.slice(0, 20_000),
    postedAt: j.pubDate ? new Date(j.pubDate * 1000).toISOString() : null,
  };
}
