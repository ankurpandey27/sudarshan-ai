export class BrowserUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BrowserUnavailableError';
  }
}
