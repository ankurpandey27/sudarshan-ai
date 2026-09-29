// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export type InsightSeverity = 'error' | 'warn' | 'info';

export interface InsightAction {
  label: string;
  to?: string;
  api?: string;
}

export interface Insight {
  id: string;
  severity: InsightSeverity;
  title: string;
  detail: string;
  fix: string;
  actions: InsightAction[];
  /**
   * Changes when the situation changes (a new count, a new careful-mode episode): a card you
   * dismissed comes back only then.
   */
  version: string;
}
