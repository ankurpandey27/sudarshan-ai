// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** How the rescue agent does with the AI model in use. */
export interface RescueStatus {
  /** "openai / gpt-5.4-mini", or null without an AI. */
  model: string | null;
  tries: number;
  /** Rescues that got the application sent or further along. */
  helped: number;
  failedInARow: number;
  /** Failed too many times in a row with this model: jobs are handed to you instead. */
  paused: boolean;
}
