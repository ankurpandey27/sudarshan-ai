export class LlmBudgetExceededError extends Error {
  constructor(used: number, budget: number) {
    super(`Daily token budget reached (${used}/${budget}). Raise it in Settings or use a local model.`);
    this.name = 'LlmBudgetExceededError';
  }
}
