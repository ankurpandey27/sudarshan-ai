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
}
