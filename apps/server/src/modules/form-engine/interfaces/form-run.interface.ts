import { AnswerContext } from './answer-context.interface';
import { UnresolvedField } from './resolve-result.interface';

export type FormRunStatus =
  | 'applied'
  | 'needs_input'
  | 'ready_to_submit'
  | 'blocked'
  | 'captcha'
  | 'stuck'
  | 'closed';

export interface RunFormOptions {
  /** null for the whole page. */
  scopeSelector: string | null;
  successPattern: RegExp;
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
}
