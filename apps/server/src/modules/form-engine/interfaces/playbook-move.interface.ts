// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** A button that was pressed on a kind of step, and how often that moved the form forward. */
export interface PlaybookMove {
  action: string;
  ok: number;
  fail: number;
}
