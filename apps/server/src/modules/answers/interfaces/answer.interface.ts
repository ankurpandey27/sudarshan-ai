// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { AnswerSource } from '../enums/answer-source.enum';

export interface Answer {
  id: number;
  key: string;
  question: string;
  /** The question in English, when it was asked in another language and has been translated. */
  questionEn?: string | null;
  /** The question is not in English (the page may translate it itself when no English is known yet). */
  foreign?: boolean;
  answer: string;
  fieldType: string | null;
  source: AnswerSource;
  uses: number;
  createdAt: string;
  updatedAt: string;
}

export interface AnswerRow {
  id: number;
  key: string;
  question: string;
  answer: string;
  field_type: string | null;
  source: string;
  uses: number;
  created_at: string;
  updated_at: string;
}

export interface AnswerMatch {
  id: number;
  answer: string;
  source: AnswerSource;
  /** 1 for an exact key match. */
  similarity: number;
  question: string;
}
