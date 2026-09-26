export interface LlmUsageSummary {
  day: string;
  calls: number;
  failedCalls: number;
  promptTokens: number;
  completionTokens: number;
  budget: number;
  byPurpose: { purpose: string; calls: number; tokens: number }[];
}
