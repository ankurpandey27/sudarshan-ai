export class LlmUnavailableError extends Error {
  constructor(message = 'No AI model configured - add one in Settings') {
    super(message);
    this.name = 'LlmUnavailableError';
  }
}
