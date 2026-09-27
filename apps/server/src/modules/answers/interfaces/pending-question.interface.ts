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
  job_id: number;
  title: string;
  company: string;
  created_at: string;
}
