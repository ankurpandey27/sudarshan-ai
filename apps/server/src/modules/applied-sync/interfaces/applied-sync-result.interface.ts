// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export interface AppliedSyncResult {
  /** Applications Indeed lists for you. */
  listed: number;
  /** Jobs marked Applied just now, because Indeed lists them. */
  marked: { id: number; title: string; company: string }[];
  /** Listed on Indeed and already Applied here. */
  alreadyApplied: number;
  /** Listed on Indeed but not in Sudarshan AI (you applied to them outside it). */
  notInSudarshan: number;
}
