// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** This many broken attempts in a row, with no success since, pause a platform. */
export const BROKEN_STREAK = 3;

/**
 * Attempt endings that suggest the site's pages changed. Captchas, questions for you, logins and
 * closed jobs are normal, and so are crashes and timeouts ("error") - none of them count.
 */
export const BROKEN_ENDINGS = ['run:stuck', 'run:closed', 'prep:no_apply_button'];

/** How long a site that refused applications ("please try again later") is left alone. */
export const REFUSED_COOLDOWN_MS = 3 * 60 * 60_000;

/** A platform paused as "may have changed" gets one new attempt this long after its last stuck one. */
export const BROKEN_RETRY_AFTER_MS = 6 * 60 * 60_000;
