import { questionKey, questionSimilarity } from './question-key.util';

describe('question matching', () => {
  it('normalises wording, punctuation and required markers to one key', () => {
    expect(questionKey('What is your notice period? *')).toBe(questionKey('Notice period (required)'));
  });

  it('matches rephrasings of the same question', () => {
    expect(questionSimilarity('Are you willing to relocate to Pune?', 'Willing to relocate to Pune')).toBeGreaterThanOrEqual(0.75);
  });

  it('never confuses current and expected CTC', () => {
    expect(questionSimilarity('What is your current CTC?', 'What is your expected CTC?')).toBe(0);
  });

  it('never confuses years with different skills', () => {
    expect(
      questionSimilarity('How many years of experience do you have with React?', 'How many years of experience do you have with Angular?'),
    ).toBe(0);
  });

  it('never matches questions that differ in a number', () => {
    expect(questionSimilarity('Can you join within 15 days?', 'Can you join within 30 days?')).toBe(0);
  });
});
