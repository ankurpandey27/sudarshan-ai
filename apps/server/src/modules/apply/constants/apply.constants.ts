// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { JobPlatform } from '../../jobs/enums/job-platform.enum';

// LinkedIn (2026) renders Easy Apply in a native <dialog data-testid="dialog">; the rest are older layouts.
export const LINKEDIN_SCOPE = 'dialog[open], .jobs-easy-apply-modal, [data-test-modal-id="easy-apply-modal"], div[role="dialog"]';

export const GENERIC_DIALOG = 'dialog[open], [role=dialog], [aria-modal=true], .modal.show, .modal[open]';
export const LINKEDIN_SUCCESS = /your application was sent|application (was )?sent to|application submitted|you applied to/i;
export const LINKEDIN_APPLIED = /\bapplied \d+ (second|minute|hour|day|week|month)s? ago\b|application submitted|see application/i;
// Also Dutch, German, French and Spanish ("404 Vacature vervuld", Aethon, 2026-09-29).
export const CLOSED_TEXT =
  /no longer accepting applications|job (has )?expired|this job is (no longer available|closed)|position has been filled|job is not available|vacature (is )?(vervuld|gesloten|verlopen)|vacature (is )?niet meer beschikbaar|stelle (ist )?(nicht mehr verfügbar|bereits besetzt|besetzt)|offre (n'est plus disponible|expirée|pourvue)|poste (a été )?pourvu|oferta (ya no está disponible|cerrada|caducada)/i;

export const NAUKRI_DRAWER = '.chatbot_DrawerContentWrapper, [class*="chatbot_Drawer"], [class*="chatbot-drawer"]';
// After a one-click apply Naukri opens a page headed: Applied to "<job title>".
export const NAUKRI_SUCCESS =
  /applied to\s*["“]|you have successfully applied|successfully applied|applied successfully|application (has been )?(sent|submitted)/i;
export const NAUKRI_APPLIED_URL = /\/(myapply|saveApply)\b/i;

/** A button that has turned into a confirmation, e.g. "Application sent!" or "Applied". */
export const APPLIED_BUTTON = /^(✓\s*)?(application sent|applied|already applied)!?$/i;

// Also WordPress contact-form applications (Betasoft, 2026-09-29): "Thank you for your message. It has been sent."
export const GENERIC_SUCCESS =
  /thank(s| you) for (applying|your application|your interest|your message|contacting)|application (has been |was )?(received|submitted|sent)|your message (has been |was )?sent|successfully (applied|submitted|sent)|we('ve| have) received your (application|message)|you('ve| have) applied/i;

export const LOGIN_WALL = /sign in to (apply|continue)|log ?in to (apply|continue)|create an account to apply|please (sign|log) in/i;

// Indeed Apply ("Easily apply") runs on smartapply.indeed.com; logged out it redirects to the login page.
export const INDEED_APPLY_HOST = /smartapply\.indeed\.com/i;
export const INDEED_LOGIN_URL = /secure\.indeed\.com\/(auth|account)|indeed\.com\/account\/login/i;
export const INDEED_CLOSED = /this job has expired|job has expired on indeed|no longer accepting applications/i;
/** Sign-in pages a job site may send a logged-out visitor to instead of the job. */
export const SIGN_IN_PAGE = /accounts\.google\.com|secure\.indeed\.com|indeed\.com\/account\/login|login\.microsoftonline\.com|appleid\.apple\.com/i;
/** Indeed's Cloudflare security check page. */
export const INDEED_CHALLENGE = /just a moment|security check|verify you are human|additional verification/i;
/**
 * Wording that proves an application was sent, for one-click apply. Unlike GENERIC_SUCCESS it
 * leaves out "thank you for your interest", which careers and sign-in pages show to everyone.
 */
export const ONE_CLICK_SUCCESS =
  /thank(s| you) for applying|application (has been |was )?(received|submitted|sent)|successfully (applied|submitted)|we('ve| have) received your application|you('ve| have) (successfully )?applied/i;
/**
 * The page says this job was already applied to. Not just "already" anywhere - career sign-in
 * pages say "Already have an account?".
 */
export const ALREADY_APPLIED_TEXT =
  /you('ve| have) already applied|already applied (to|for) this|application (was |has been )?already (submitted|sent|received)/i;
/** Indeed's own confirmation after Submit - its forms mention "applied" everywhere else. */
// "Your application was submitted to SAMMAAN Capital Finance" (2026-09-29), "...has been submitted".
export const INDEED_SUCCESS =
  /your application (has been |was |is )?submitted|application (has been |was )?submitted to|we('ve| have) received your application/i;
/** Indeed's confirmation page, whatever its wording. */
export const INDEED_SUCCESS_URL = /smartapply\.indeed\.com\/.*\/post-apply\b/i;
/** A Naukri chat question that asks for a file (resume, CV); only then is the resume sent. */
export const NAUKRI_FILE_QUESTION = /\b(resume|cv|curriculum vitae|upload|attach)/i;

/** "How did you hear about this job?": where the job was found. */
export const FOUND_ON: Record<JobPlatform, string> = {
  [JobPlatform.LINKEDIN]: 'LinkedIn',
  [JobPlatform.NAUKRI]: 'Naukri',
  [JobPlatform.INDEED]: 'Indeed',
  [JobPlatform.INSTAHYRE]: 'Instahyre',
  [JobPlatform.FOUNDIT]: 'Foundit',
  [JobPlatform.HIRIST]: 'Hirist',
  [JobPlatform.OTHER]: 'Company website',
};

/** Tries per job before it goes to "Do by hand", so the queue never loops on one job. Approving it again yourself resets this. */
export const MAX_APPLY_ATTEMPTS = 3;

/** How long a career page may take to draw its Apply button or form after the network goes quiet (Workday). */
export const RENDER_WAIT_MS = 10_000;

/** Errors from reading a page the site replaced mid-read; reading again a moment later works. */
export const PAGE_SWAPPED = /detached Frame|Execution context was destroyed|Cannot find context|Target closed|frame was detached/i;

/**
 * Naukri refusing an application for now (its apply request answers 403), usually after many in a
 * short time (2026-09-29: 26 in an hour). Not a problem with the job or the form.
 */
export const NAUKRI_REFUSED = /error while processing your request|please try again later/i;

/** How long LinkedIn's Apply may take to reach the company's site (its redirect page comes first). */
export const COMPANY_SITE_WAIT_MS = 15_000;

/** How long a click may take to open a new tab (LinkedIn opens the company site after a few seconds). */
export const NEW_TAB_WAIT_MS = 15_000;
/** A button on a company site that may open its form in a new tab: most open none, so this stays short. */
export const SAME_SITE_TAB_WAIT_MS = 7000;
/** Hiring systems whose application a career page may show inside a frame; opened as a page instead. */
export const EMBEDDED_ATS =
  /^https:\/\/([a-z0-9-]+\.)*(ashbyhq\.com|greenhouse\.io|lever\.co|workable\.com|smartrecruiters\.com|recruitee\.com|bamboohr\.com|breezy\.hr|jobvite\.com|teamtailor\.com|personio\.(de|com)|pinpointhq\.com|rippling-ats\.com|rippling\.com|homerun\.co|jazzhr\.com|applytojob\.com|zohorecruit\.(com|in|eu)|freshteam\.com|keka\.com|darwinbox\.in|comeet\.(co|com))\//i;
/** How long a career page that looks like a login may take to add its embedded application. */
export const EMBED_WAIT_MS = 6000;

/** Step pictures kept per attempt, at most (small JPEGs, cleared with old screenshots). */
export const MAX_SHOTS = 24;
/** After you solve a captcha, Sudarshan carries on only once you have not touched the tab for this long. */
export const CONTINUE_IDLE_MS = 15_000;

/** A company page still drawing (spinner, hardly any text) is waited for this long (Workday, 2026-09-30). */
export const SLOW_RENDER_WAIT_MS = 30_000;

/** Presses on the way from a job page to its application form, plus one look at where the last one led. */
export const MAX_APPLY_HOPS = 5;

/** A connection problem (Wi-Fi drop, DNS, QUIC, a page that never loaded) - not a problem with the job. */
export const NETWORK_ERROR = /net::ERR_|chrome-error:\/\/|Navigation timeout of \d+ ms exceeded|ERR_INTERNET_DISCONNECTED|ECONNRESET|ETIMEDOUT|socket hang up/i;

/** Network failures on one job retried for free; after that it counts like any other error. */
export const MAX_NETWORK_RETRIES = 3;

/** Tabs handed over to you kept open at most; beyond that the oldest is closed (its job opens again from Applications). */
export const MAX_OPEN_TABS = 12;
