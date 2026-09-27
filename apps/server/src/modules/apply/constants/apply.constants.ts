// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

// LinkedIn (2026) renders Easy Apply in a native <dialog data-testid="dialog">; the rest are older layouts.
export const LINKEDIN_SCOPE = 'dialog[open], .jobs-easy-apply-modal, [data-test-modal-id="easy-apply-modal"], div[role="dialog"]';

export const GENERIC_DIALOG = 'dialog[open], [role=dialog], [aria-modal=true], .modal.show, .modal[open]';
export const LINKEDIN_SUCCESS = /your application was sent|application (was )?sent to|application submitted|you applied to/i;
export const LINKEDIN_APPLIED = /\bapplied \d+ (second|minute|hour|day|week|month)s? ago\b|application submitted|see application/i;
export const CLOSED_TEXT =
  /no longer accepting applications|job (has )?expired|this job is (no longer available|closed)|position has been filled|job is not available/i;

export const NAUKRI_DRAWER = '.chatbot_DrawerContentWrapper, [class*="chatbot_Drawer"], [class*="chatbot-drawer"]';
// After a one-click apply Naukri opens a page headed: Applied to "<job title>".
export const NAUKRI_SUCCESS =
  /applied to\s*["“]|you have successfully applied|successfully applied|applied successfully|application (has been )?(sent|submitted)/i;
export const NAUKRI_APPLIED_URL = /\/(myapply|saveApply)\b/i;

/** A button that has turned into a confirmation, e.g. "Application sent!" or "Applied". */
export const APPLIED_BUTTON = /^(✓\s*)?(application sent|applied|already applied)!?$/i;

export const GENERIC_SUCCESS =
  /thank(s| you) for (applying|your application|your interest)|application (has been |was )?(received|submitted|sent)|successfully (applied|submitted)|we('ve| have) received your application|you('ve| have) applied/i;

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
