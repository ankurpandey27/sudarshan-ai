// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

const DAY = 86_400_000;

/** How long files Sudarshan writes are kept. */
export const KEEP_SCREENSHOTS_MS = 30 * DAY;
export const KEEP_LOGS_MS = 14 * DAY;
/** Older resume uploads; the one in use is always kept. */
export const KEEP_OLD_UPLOADS_MS = 30 * DAY;
export const HOUSEKEEPING_EVERY_MS = DAY;

/** Daily database backups kept. */
export const KEEP_BACKUPS = 7;
