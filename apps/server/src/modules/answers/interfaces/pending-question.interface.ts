// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export interface PendingQuestionInput {
  jobId: number;
  question: string;
  fieldType: string;
  options: string[];
  suggestion: string | null;
}

export interface PendingQuestionGroup {
  key: string;
  question: string;
  fieldType: string;
  options: string[];
  suggestion: string | null;
  /** The question in English, when it was asked in another language (null until translated, or when English). */
  questionEn: string | null;
  /** Its options in English, in the same order. */
  optionsEn: string[] | null;
  jobIds: number[];
  jobs: { id: number; title: string; company: string }[];
  firstAskedAt: string;
}

export interface PendingQuestionRow {
  key: string;
  question: string;
  field_type: string;
  options: string;
  suggestion: string | null;
  question_en: string | null;
  options_en: string | null;
  job_id: number;
  title: string;
  company: string;
  created_at: string;
}
