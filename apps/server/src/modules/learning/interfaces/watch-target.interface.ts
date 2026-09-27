// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export interface WatchTarget {
  jobId: number;
  jobLabel: string;
  domain: string;
  /** The application dialog, or null for a whole-page form. */
  scopeSelector: string | null;
  successPattern: RegExp;
}
