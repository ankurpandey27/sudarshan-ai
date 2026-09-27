// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { AnswerSource } from '../enums/answer-source.enum';

export const ANSWER_SOURCE_TRUST: Record<AnswerSource, number> = {
  [AnswerSource.USER]: 3,
  [AnswerSource.EXCEL]: 3,
  [AnswerSource.LLM]: 1,
};

export const FUZZY_MATCH_THRESHOLD = 0.75;

/** Stand-in labels for fields with no real question; answers to them are never remembered or reused. */
export const GENERIC_QUESTION = /^(choose an option|select( an?)?( option| one)?|please select|choose|pick one|option|answer|-+)$/i;
