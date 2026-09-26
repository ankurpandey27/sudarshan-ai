export interface LlmFailure {
  kind: 'auth' | 'quota' | 'other';
  provider: string;
  model: string;
  message: string;
  at: string;
}
