// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { AnswerContext } from './answer-context.interface';
import { LearnedMove } from './learned-move.interface';
import { UnresolvedField } from './resolve-result.interface';

export type FormRunStatus = 'applied' | 'needs_input' | 'ready_to_submit' | 'blocked' | 'captcha' | 'stuck' | 'closed' | 'refused';

export interface RunFormOptions {
  /** null for the whole page. */
  scopeSelector: string | null;
  successPattern: RegExp;
  /** The site's confirmation page address, when it has one - counts whatever the page says. */
  successUrl?: RegExp;
  ctx: AnswerContext;
  domain: string;
  maxSteps?: number;
  allowLlm: boolean;
  pauseBeforeSubmit: boolean;
  onStep: (message: string) => void;
}

export interface FormRunOutcome {
  status: FormRunStatus;
  detail: string;
  unresolved: UnresolvedField[];
  steps: number;
  fields: number;
  memoryHits: number;
  profileHits: number;
  llmCalls: number;
  /** Buttons that moved the form on during this run, in order - not yet learned. */
  moves?: LearnedMove[];
  /** The button that failed on the step where the run got stuck, if one did. */
  stuckAt?: LearnedMove | null;
}
