// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { COUNTRIES, INDEED_COUNTRY, REGIONS_ABROAD, SITE_COUNTRY, US_STATE_SUFFIX } from '../constants/countries.constants';
import { JobRegion, WorkMode } from '../enums/job-place.enum';
import { JobPlatform } from '../enums/job-platform.enum';

/** What a job's place is read from. */
export interface PlaceInput {
  platform: JobPlatform | string;
  url: string;
  title: string;
  location: string;
  isRemote: boolean;
  description: string;
}

/** Where you are, and the places learned to be in your country. */
export interface HomeContext {
  /** Your country's names ("india", "bharat"), lowercased; empty when the profile has no country. */
  country: readonly string[];
  /** Cities, states and areas in your country: your profile, your searches, and what listings showed. */
  places: ReadonlySet<string>;
  /** Places listings showed in other countries ("madrid" from "Madrid, Community of Madrid, Spain"). */
  abroad?: ReadonlySet<string>;
}

const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const hasWord = (text: string, word: string): boolean => new RegExp(`(^|[^a-z])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z])`).test(text);

/** The names of a country as listings write them, from how the profile names it ("India", "IN", "Bharat"). */
export function countryNames(country: string): string[] {
  const lower = norm(country);
  if (!lower) return [];
  return [...(COUNTRIES.find((names) => names.some((n) => norm(n) === lower)) ?? [lower])];
}

/** The country a listing names, if it names exactly one place on the list (else null). */
function namedCountry(text: string): string | null {
  for (const names of COUNTRIES) if (names.some((n) => hasWord(text, norm(n)))) return names[0];
  return null;
}

/** "Noida, Uttar Pradesh, India" -> ["noida", "uttar pradesh"]: the place names before the country. */
export function placeParts(location: string): string[] {
  return norm(location)
    .replace(/\(.*?\)/g, ' ')
    .split(/[,/|;-]| and /)
    .map((p) =>
      p
        .replace(/\b(greater|metropolitan|metro|capital|statistical|bay|area|region|district|division|city|east|west|north|south)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((p) => p.length >= 3 && !/^(remote|hybrid|on-?site|work from home|wfh|anywhere)$/.test(p));
}

/** The country a job site lists jobs from, when it lists one country only. */
function siteCountry(platform: string, url: string): string | null {
  if (SITE_COUNTRY[platform]) return SITE_COUNTRY[platform];
  const host = (() => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return '';
    }
  })();
  if (/(^|\.)indeed\.com$/.test(host)) {
    const sub = host.split('.')[0];
    return sub === 'www' || sub === 'indeed' ? 'united states' : (INDEED_COUNTRY[sub] ?? null);
  }
  return null;
}

/**
 * How a job is worked. A location or title that says hybrid wins over "remote" (Naukri: "Hybrid - Bengaluru");
 * then remote; then a description that clearly describes a hybrid set-up ("3 days a week in the office").
 */
export function workModeOf(job: Pick<PlaceInput, 'title' | 'location' | 'isRemote' | 'description'>): WorkMode {
  const head = norm(`${job.title} ${job.location}`);
  if (/\bhybrid\b/.test(head)) return WorkMode.HYBRID;
  if (job.isRemote || /\b(remote|work from home|wfh|work from anywhere)\b/.test(head)) return WorkMode.REMOTE;
  const desc = norm(job.description).slice(0, 4000);
  if (/\bhybrid (work|working|model|role|mode|set-?up|arrangement|position|schedule)\b|\b\d (days?|times) (a|per) week (in|at|from) (the )?office\b/.test(desc)) {
    return WorkMode.HYBRID;
  }
  return WorkMode.ONSITE;
}

/**
 * Where a job is, from your country. In order: the listing names your country, or a place known to be in it; it
 * names another country, a wider area ("Europe", "Anywhere"), or a US place written the US way; the job site lists
 * one country's jobs only; else unknown - never guessed.
 */
export function regionOf(job: PlaceInput, home: HomeContext): JobRegion {
  if (!home.country.length) return JobRegion.UNKNOWN;
  const loc = norm(job.location);
  // "Remote (India)", "Remote / Remote (India)": the country a remote job is open to.
  const said = namedCountry(loc);
  if (said) return home.country.includes(said) ? JobRegion.HOME : JobRegion.ABROAD;
  const parts = placeParts(job.location);
  if (parts.some((p) => home.places.has(p))) return JobRegion.HOME;
  if (parts.length && parts.every((p) => home.abroad?.has(p))) return JobRegion.ABROAD;
  if (REGIONS_ABROAD.test(loc) || US_STATE_SUFFIX.test(job.location)) {
    return home.country.includes('united states') && US_STATE_SUFFIX.test(job.location) ? JobRegion.HOME : JobRegion.ABROAD;
  }
  const site = siteCountry(job.platform, job.url);
  if (site) return home.country.includes(site) ? JobRegion.HOME : JobRegion.ABROAD;
  return JobRegion.UNKNOWN;
}

/**
 * The places known to be in your country: your profile and search places, and every place a listing wrote next to
 * your country's name ("Noida, Uttar Pradesh, India" teaches "noida" and "uttar pradesh"), or listed on a site that
 * only has jobs from your country. Then "Noida" alone, or "Greater Delhi Area", is known to be home.
 */
export function learnHomePlaces(country: readonly string[], own: string[], listings: Pick<PlaceInput, 'platform' | 'url' | 'location'>[]): Set<string> {
  const places = new Set<string>();
  const add = (location: string) => {
    for (const part of placeParts(location)) if (!namedCountry(part) && !REGIONS_ABROAD.test(part)) places.add(part);
  };
  for (const ownPlace of own) add(ownPlace);
  if (!country.length) return places;
  for (const listing of listings) {
    const named = namedCountry(norm(listing.location));
    const fromSite = siteCountry(listing.platform, listing.url);
    if ((named && country.includes(named)) || (!named && fromSite && country.includes(fromSite))) add(listing.location);
  }
  return places;
}

/** The places listings showed next to another country's name, so "Greater Madrid Metropolitan Area" is known to be abroad. */
export function learnAbroadPlaces(country: readonly string[], home: ReadonlySet<string>, listings: Pick<PlaceInput, 'location'>[]): Set<string> {
  const places = new Set<string>();
  if (!country.length) return places;
  for (const listing of listings) {
    const named = namedCountry(norm(listing.location));
    if (!named || country.includes(named)) continue;
    for (const part of placeParts(listing.location)) if (!home.has(part) && !namedCountry(part)) places.add(part);
  }
  return places;
}
