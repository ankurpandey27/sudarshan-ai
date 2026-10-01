// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export const GUEST_HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  'accept-language': 'en-US,en;q=0.9',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

export const LINKEDIN_GUEST_SEARCH = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search';
export const LINKEDIN_GUEST_POSTING = 'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting';
export const LINKEDIN_PAGE_SIZE = 10;
// How deep one search reads when the top results are all jobs seen before.
export const LINKEDIN_MAX_PAGES = 10;

export const NAUKRI_SEARCH_API = /\/jobapi\/v\d+\/search/;
export const NAUKRI_MAX_PAGES = 5;

// Instahyre's public job search (the data behind instahyre.com/search-jobs). Verified filters:
// skills=<skill>, job_functions=<id> (repeat for several), jobLocations=<city> (repeat), years=<experience>.
export const INSTAHYRE_ORIGIN = 'https://www.instahyre.com';
export const INSTAHYRE_SEARCH_API = '/api/v1/job_search';
/** A small public JSON address used to get the tab onto instahyre.com quickly. */
export const INSTAHYRE_WARMUP_PATH = '/api/v1/job_function?limit=1';
export const INSTAHYRE_PAGE_SIZE = 35;
export const INSTAHYRE_MAX_PAGES = 3;
/** Instahyre answers 429 after a handful of quick requests: keep a human pace. */
export const INSTAHYRE_PAGE_DELAY_MS: [number, number] = [7000, 10_000];
export const INSTAHYRE_BACKOFF_MS = 60_000;
/** Job function ids, from instahyre.com/api/v1/job_function. */
export const INSTAHYRE_JOB_FUNCTIONS: { match: RegExp; id: number }[] = [
  { match: /back[\s-]?end/i, id: 10 },
  { match: /full[\s-]?stack/i, id: 1 },
];

// Indeed India search. Verified: results are embedded in the page (mosaic-provider-jobcards), 15 per page;
// paging is &start=10, 20...; logged out, page 2 redirects to the login page.
export const INDEED_ORIGIN = 'https://in.indeed.com';
export const INDEED_PAGE_STEP = 10;
export const INDEED_MAX_PAGES = 5;
/** Indeed is the strictest about automation: long, human gaps between pages. */
export const INDEED_PAGE_DELAY_MS: [number, number] = [12_000, 18_000];
/** The "Date posted" choices Indeed offers. */
export const INDEED_FROMAGE_DAYS = [1, 3, 7, 14];
/** How long to let Indeed's security check ("Just a moment...") clear by itself. */
export const INDEED_CHALLENGE_WAIT_MS = 45_000;

/** New jobs one combined search may bring (the separate searches' total, capped). */
export const MAX_COMBINED_PER_SEARCH = 150;
/** Full descriptions fetched per search keyword; later ones are read when a job is opened. */
export const MAX_ENRICH_PER_SEARCH = 40;
