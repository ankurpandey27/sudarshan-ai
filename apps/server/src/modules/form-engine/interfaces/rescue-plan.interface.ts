// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** One thing the rescue agent wants done: press a control, or choose an option in a field. */
export interface RescueAction {
  click?: string;
  /** This press sends the application (the AI's judgement, next to Sudarshan's own). */
  submits?: boolean;
  choose?: string;
  option?: string;
  /** A file field that wants the resume: it gets yours (never anything else). */
  upload?: string;
}

/** What the AI returns for one rescue step. */
export interface RescuePlan {
  actions?: RescueAction[];
  /** The page already confirms the application was sent. */
  done?: boolean;
  /** Nothing more can be done here without the person. */
  stuck?: boolean;
  why?: string;
}
