// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** Words in company names and job titles that say nothing about which company or job it is. */
const GENERIC =
  /^(inc|ltd|llc|llp|plc|pvt|private|limited|corp|corporation|company|co|the|and|of|for|group|global|india|technologies|technology|tech|solutions|services|software|systems|labs|consulting|digital|international|remote|hybrid|onsite|senior|junior|lead|staff|principal|sr|jr|ii|iii|iv|full|time|part|contract|intern|internship|with|in|at|to|a|an)$/;

const words = (s: string): string[] =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w.length >= 3 && !GENERIC.test(w));

/**
 * Whether a page reached on the way to an application is about this job: it names the company (in its text, its title
 * or its address) or most of the job title. A press on Himalayas landed on a business school's sign-up page and
 * Sudarshan filled it with your details (Mesa School, 2026-10-05) - such a page names neither. When the company and
 * title give nothing to look for, the page is not held back.
 */
export function mentionsJob(pageText: string, url: string, job: { title: string; company: string }): boolean {
  const text = ` ${words(pageText).join(' ')} `;
  const compact = (pageText + ' ' + url).toLowerCase().replace(/[^a-z0-9]+/g, '');
  const company = words(job.company);
  const title = words(job.title);
  if (!company.length && title.length < 2) return true;
  const companyWhole = job.company.toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (companyWhole.length >= 3 && compact.includes(companyWhole)) return true;
  if (company.some((w) => text.includes(` ${w} `) || compact.includes(w))) return true;
  const seen = title.filter((w) => text.includes(` ${w} `)).length;
  return title.length >= 2 && seen / title.length >= 0.6;
}

/**
 * Whether a job page's main heading is about another job: it shares no word with the job's title. Atlassian's page for
 * "Principal Backend Software Engineer" had come to show "Senior Product Manager" (2026-10-05) - applying there would
 * have been for that. An empty heading, or a title with nothing to compare, is never held against the page.
 */
export function headingIsAnotherJob(heading: string, title: string): boolean {
  const want = words(title);
  const have = words(heading);
  if (want.length < 2 || have.length < 2) return false;
  return !want.some((w) => have.includes(w));
}
