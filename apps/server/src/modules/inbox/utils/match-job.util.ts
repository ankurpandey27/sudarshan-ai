// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { escapeRegex } from '../../../common/utils/regex.util';
import { COMPANY_NOISE, SHARED_SENDERS } from '../constants/inbox.constants';
import { MailMessage } from '../interfaces/inbox.interface';

export interface AppliedJob {
  id: number;
  title: string;
  company: string;
  appliedAt: string;
}

/** "Acme Technologies Pvt. Ltd." -> "acme"; "" when nothing distinctive is left. */
export function companyKey(company: string): string {
  return company.toLowerCase().replace(COMPANY_NOISE, ' ').replace(/[^a-z0-9& ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const word = (text: string, phrase: string) => new RegExp(`(?<![a-z0-9])${escapeRegex(phrase)}(?![a-z0-9])`, 'i').test(text);

/**
 * The application a reply is about: the company must be named - in the sender's domain (mail from acme.com is from
 * Acme), or, for job boards and applicant tracking systems that write for many companies, in the subject or text.
 * Several applications to that company: the one whose title the reply mentions, else the latest sent before it.
 */
export function matchJob(msg: MailMessage, jobs: AppliedJob[]): number | null {
  const domain = (msg.from.split('@')[1] ?? '').toLowerCase();
  // Judged by the domain only: hr@acme.com and careers@acme.com are Acme itself.
  const shared = SHARED_SENDERS.test(domain);
  const text = `${msg.subject}\n${msg.fromName}\n${msg.text.slice(0, 4000)}`.toLowerCase();
  const before = jobs.filter((j) => j.appliedAt <= msg.at);

  const named = before.filter((j) => {
    const key = companyKey(j.company);
    if (key.length < 3) return false;
    // acme.com, acmetech.com and zetalabs.com (for "Zeta Labs") are the company's own domains.
    const slug = key.replace(/[^a-z0-9]/g, '');
    const full = j.company.toLowerCase().replace(/[^a-z0-9]/g, '');
    const parts = domain.replace(/[^a-z0-9.]/g, '').split('.');
    const byDomain = !shared && slug.length >= 3 && parts.some((p) => p === slug || (slug.length >= 4 && p.startsWith(slug)) || (p.length >= 5 && full.startsWith(p)));
    return byDomain || word(text, key);
  });
  if (!named.length) return null;
  if (named.length === 1) return named[0].id;

  const byTitle = named.filter((j) => j.title.length >= 4 && word(text, j.title.toLowerCase()));
  const pool = byTitle.length ? byTitle : named;
  return [...pool].sort((a, b) => b.appliedAt.localeCompare(a.appliedAt))[0].id;
}
