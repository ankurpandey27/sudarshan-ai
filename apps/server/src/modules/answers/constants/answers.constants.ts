// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { AnswerSource } from '../enums/answer-source.enum';

export const ANSWER_SOURCE_TRUST: Record<AnswerSource, number> = {
  [AnswerSource.USER]: 3,
  [AnswerSource.EXCEL]: 3,
  [AnswerSource.LLM]: 1,
};

export const FUZZY_MATCH_THRESHOLD = 0.75;
