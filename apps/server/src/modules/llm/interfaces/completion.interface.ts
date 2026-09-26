export interface CompletionRequest {
  system?: string;
  prompt: string;
  maxTokens: number;
  json?: boolean;
}

export interface Completion {
  text: string;
  promptTokens: number;
  completionTokens: number;
}
