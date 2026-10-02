// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** Where the mailbox details are kept (a row of the settings table; the password encrypted). */
export const INBOX_KEY = 'inbox';

/** The mailbox is checked this often while Sudarshan runs. */
export const INBOX_CHECK_MS = 30 * 60_000;

/** The first check reads this many days back; later ones only what is new. */
export const INBOX_FIRST_DAYS = 30;

/** At most this many messages are read per check. */
export const INBOX_MAX_PER_CHECK = 300;

/** Only so much of a message is read - replies say what they mean near the top. */
export const INBOX_TEXT_CHARS = 4000;

/** Applications sent this many days back can still get a reply. */
export const REPLY_WINDOW_DAYS = 120;

/** IMAP servers of common providers, by the domain of your address. */
export const IMAP_PRESETS: Record<string, { host: string; port: number; help: string }> = {
  'gmail.com': {
    host: 'imap.gmail.com',
    port: 993,
    help: 'Google Account -> Security -> 2-Step Verification on -> App passwords -> create one for "Sudarshan".',
  },
  'googlemail.com': { host: 'imap.gmail.com', port: 993, help: 'Google Account -> Security -> App passwords.' },
  'yahoo.com': { host: 'imap.mail.yahoo.com', port: 993, help: 'Yahoo Account security -> Generate app password.' },
  'yahoo.in': { host: 'imap.mail.yahoo.com', port: 993, help: 'Yahoo Account security -> Generate app password.' },
  'icloud.com': { host: 'imap.mail.me.com', port: 993, help: 'appleid.apple.com -> Sign-In and Security -> App-Specific Passwords.' },
  'me.com': { host: 'imap.mail.me.com', port: 993, help: 'appleid.apple.com -> App-Specific Passwords.' },
  'zoho.com': { host: 'imap.zoho.com', port: 993, help: 'Zoho Mail -> Settings -> Mail Accounts -> IMAP access on; use an app password if 2FA is on.' },
  'zohomail.in': { host: 'imap.zoho.in', port: 993, help: 'Zoho Mail -> Settings -> IMAP access on.' },
  'fastmail.com': { host: 'imap.fastmail.com', port: 993, help: 'Fastmail -> Settings -> Privacy & Security -> App passwords.' },
  'rediffmail.com': { host: 'imap.rediffmail.com', port: 993, help: 'Use your Rediffmail password.' },
};

/** Words that mark a message as about a job application at all. */
export const ABOUT_APPLICATION =
  /\b(application|applied|applying|candidature|candidate|position|role|opening|vacancy|interview|recruit\w*|hiring|talent acquisition|assessment|shortlist\w*|offer)\b/i;

/** Job alerts and newsletters - about jobs, but never a reply to you. */
export const NOT_A_REPLY =
  /\b(job alert|jobs? (you may|you might|for you|matching)|recommended jobs?|new jobs?\b|jobs? near you|similar jobs|people (also )?viewed|weekly digest|newsletter|webinar|unsubscribe from (these|job) alerts|top companies hiring|is hiring\b(?! you)|premium|resume (score|review service))/i;

/** Parts of company names left out when matching ("Acme Technologies Pvt Ltd" is "acme"). */
export const COMPANY_NOISE =
  /\b(private|pvt|limited|ltd|llp|llc|inc|incorporated|corp|corporation|co|company|technologies|technology|tech|solutions|services|software|systems|labs|global|group|india|international|the)\b\.?/gi;

/** Sender domains that write for many companies (job boards, applicant tracking systems): the company is named inside. */
export const SHARED_SENDERS =
  /(greenhouse|lever\.co|myworkday|workday|smartrecruiters|ashbyhq|icims|taleo|successfactors|jobvite|recruitee|breezy|workable|zoho(recruit)?|naukri|linkedin|indeed|instahyre|keka|darwinbox|freshteam|hirist|cutshort|wellfound|gmail|outlook|yahoo|hotmail)\b/i;
