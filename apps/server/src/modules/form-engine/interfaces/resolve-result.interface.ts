// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { FillInstruction } from './fill-instruction.interface';
import { FormField } from './form-field.interface';

export interface UnresolvedField {
  field: FormField;
  suggestion: string | null;
}

export interface ResolveStats {
  fields: number;
  profileHits: number;
  memoryHits: number;
  llmCalls: number;
  llmAnswers: number;
  /** Of the AI answers, how many it worked out from your profile rather than read in it. */
  inferred?: number;
  /** Questions the AI answered with your own past answers to similar questions in front of it. */
  pastAnswerHints?: number;
  /** Fields filled because the field learner recognised which of your details they ask for. */
  learnedHits?: number;
}

export interface ResolveResult {
  instructions: FillInstruction[];
  unresolved: UnresolvedField[];
  /** Required uploads other than the resume, e.g. a cover letter. */
  blockers: string[];
  stats: ResolveStats;
}

export interface ResolveOptions {
  allowLlm: boolean;
  /** Re-answer these even if filled (validation failed). */
  force?: Set<string>;
}

export interface LlmFieldAnswer {
  id: string;
  value: string;
  confident?: boolean;
  reusable?: boolean;
  /** "fact": stated in the profile; "inferred": a reasonable reading of it (low-stakes questions only); "unknown". */
  basis?: 'fact' | 'inferred' | 'unknown';
}
