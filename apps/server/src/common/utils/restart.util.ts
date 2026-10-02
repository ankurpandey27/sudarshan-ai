// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** Asks the server to close cleanly and exit with RESTART_EXIT_CODE; `npm start` then starts it again. */
export const RESTART_EVENT = 'sudarshan:restart';

/** Exit code meaning "start me again" (for scripts/start.mjs). */
export const RESTART_EXIT_CODE = 75;

export function requestRestart(): void {
  process.emit(RESTART_EVENT as never);
}
