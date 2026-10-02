// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export interface InterviewQuestion {
  id: string;
  question: string;
  /** Which form questions this story helps answer. */
  why: string;
  /** What a good, specific answer looks like. */
  example: string;
}
