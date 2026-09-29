// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** One of your saved answers, similar in meaning to a question being asked. */
export interface PastAnswer {
  question: string;
  answer: string;
  /** 0-1: how close in meaning the two questions are. */
  similarity: number;
}
