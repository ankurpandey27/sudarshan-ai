// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** When to look for the site's confirmation after a click or a new page: sending can take a few seconds. */
export const CONFIRM_CHECKS_MS = [1500, 4000, 8000, 15000];

// Never stored, whatever the page calls them.
export const SECRET_QUESTION = /pass(word|code)|otp|one[- ]?time|verification code|captcha|cvv|card ?number|security code|\bpin\b/i;
