import { LlmPurpose } from '../enums/llm-purpose.enum';

export interface LlmCallOptions {
  purpose: LlmPurpose;
  system?: string;
  maxTokens?: number;
}
