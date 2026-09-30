// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** Indeed's own list of the applications you sent. */
export const INDEED_APPLIED_URL = 'https://myjobs.indeed.com/applied';
/** How long the list may take to appear. */
export const APPLIED_LIST_WAIT_MS = 30_000;
/** The list loads more as you scroll: at most this many scrolls... */
export const APPLIED_MAX_SCROLLS = 30;
/** ...waiting this long after each one... */
export const APPLIED_SCROLL_WAIT_MS = 1500;
/** ...and stopping once this many scrolls in a row bring nothing new. */
export const APPLIED_STABLE_SCROLLS = 2;
export const CONFIRMED_ON_INDEED = 'Applied - confirmed on Indeed (My jobs)';
/** Indeed's sign-in form must stay on screen this long before it counts as "signed out" (it is passed through briefly when logged in). */
export const SIGN_IN_SETTLE_MS = 6000;
