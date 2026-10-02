// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** Where the Telegram bot's details are kept (a row of the settings table; the token encrypted). */
export const TELEGRAM_KEY = 'telegram';

/** The day the last daily summary was sent (a row of the settings table). */
export const SUMMARY_SENT_KEY = 'summary.lastDay';

/** How often the summary time is checked. */
export const SUMMARY_CHECK_MS = 5 * 60_000;

/** Applications that need you are gathered for this long, then sent as one message. */
export const NEEDS_YOU_GATHER_MS = 2 * 60_000;

export const TELEGRAM_API = 'https://api.telegram.org';

/** Telegram's limit for one message. */
export const TELEGRAM_MAX_CHARS = 4000;

export const TELEGRAM_TIMEOUT_MS = 15_000;
