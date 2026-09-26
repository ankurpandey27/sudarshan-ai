export interface LlmJobScore {
  id: number;
  score: number;
  summary?: string;
  matched?: string[];
  missing?: string[];
}

export interface ScoringRunResult {
  scored: number;
  review: number;
  queued: number;
  skipped: number;
  llmCalls: number;
  skippedBy: Record<string, number>;
}

export interface LastScoringRun extends ScoringRunResult {
  total: number;
  at: string;
}
