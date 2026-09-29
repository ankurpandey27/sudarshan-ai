// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

// How the answer engine uses your past answers and your own saved answers (2026-09-30).

import { StorageService } from '../../common/storage/storage.service';
import { AnswersService } from '../answers/answers.service';
import { AnswerSource } from '../answers/enums/answer-source.enum';
import { PastAnswer } from '../answers/interfaces/past-answer.interface';
import { PastAnswersService } from '../answers/past-answers.service';
import { LlmService } from '../llm/llm.service';
import { EMPTY_PROFILE } from '../profile/constants/profile.constants';
import { AnswerEngineService } from './answer-engine.service';
import { FieldKind } from './enums/field-kind.enum';
import { AnswerContext } from './interfaces/answer-context.interface';
import { FormField } from './interfaces/form-field.interface';
import { sameSubject } from './utils/subject.util';

const field = (label: string, kind = FieldKind.TEXT, options: string[] = []): FormField => ({
  id: 'f',
  kind,
  label,
  name: '',
  placeholder: '',
  required: true,
  value: '',
  options,
  optionIds: options.map((_, i) => `o${i}`),
  error: '',
  maxLength: null,
  min: null,
  max: null,
  accept: null,
});

const ctx: AnswerContext = {
  profile: { ...EMPTY_PROFILE, country: 'India', city: 'Noida', totalYearsExperience: 4.9, linkedinUrl: 'https://www.linkedin.com/in/priya' },
  job: { id: 1, title: 'Backend', company: 'Acme', location: 'Noida', description: '' },
  resumePath: null,
  skillYears: () => null,
};

/** An AI that records what it was shown and answers nothing. */
const make = (past: PastAnswer[] = []) => {
  const prompts: string[] = [];
  const llm = {
    isAvailable: () => true,
    json: async (prompt: string) => {
      prompts.push(prompt);
      return { answers: [] };
    },
  } as unknown as LlmService;
  const answers = new AnswersService(new StorageService(':memory:'));
  const pastAnswers = { similar: async (qs: string[]) => qs.map(() => past) } as unknown as PastAnswersService;
  return { answers, prompts, engine: new AnswerEngineService(answers, llm, pastAnswers), plain: new AnswerEngineService(answers, llm) };
};

describe('past answers shown to the AI', () => {
  it('shows the AI your answers to similar questions, as a hint it judges', async () => {
    const { engine, prompts } = make([{ question: 'Expected CTC (LPA)', answer: '18', similarity: 0.88 }]);
    const r = await engine.resolve([field('What is your expected in-hand salary?')], ctx, { allowLlm: true });
    expect(prompts[0]).toContain('Candidate\'s own answers to similar questions: \\"Expected CTC (LPA)\\" -> \\"18\\" (0.88)');
    expect(r.stats.pastAnswerHints).toBe(1);
  });

  it("shows another subject's years to no one (DevOps is not Automation)", async () => {
    const { engine, prompts } = make([{ question: 'Automation experience (years)', answer: '5', similarity: 0.83 }]);
    await engine.resolve([field('DevOps Engineering experience (years)')], ctx, { allowLlm: true });
    expect(prompts[0]).not.toContain('Automation experience');
  });

  it('works exactly as before without the meaning model', async () => {
    const { plain, prompts } = make();
    const r = await plain.resolve([field('What is your expected in-hand salary?')], ctx, { allowLlm: true });
    expect(prompts[0]).not.toContain('similar questions:');
    expect(r.stats.pastAnswerHints).toBeUndefined();
  });

  it('knows which years questions are about the same subject', () => {
    expect(sameSubject('React experience (years)', 'React / Next.js experience (years)')).toBe(true);
    expect(sameSubject('How many years of Node.js experience do you have?', 'Node JS experience (years)')).toBe(true);
    expect(sameSubject('DevOps Engineering experience (years)', 'Automation experience (years)')).toBe(false);
    expect(sameSubject('Total years of experience', 'How many years of experience do you have?')).toBe(true);
    expect(sameSubject('Total years of experience', 'AWS experience (years)')).toBe(false);
  });
});

describe('your own answer beats a default', () => {
  it('uses your saved answer instead of the default "Yes" to working onsite', async () => {
    const { answers, engine } = make();
    answers.remember('Comfortable working in an onsite setting?', 'No', AnswerSource.USER);
    const r = await engine.resolve([field('Comfortable working in an onsite setting?', FieldKind.RADIO, ['Yes', 'No'])], ctx, { allowLlm: false });
    expect(r.instructions[0]?.value).toBe('No');
  });

  it('keeps the default when you never answered it yourself', async () => {
    const { engine } = make();
    const r = await engine.resolve([field('Comfortable working in an onsite setting?', FieldKind.RADIO, ['Yes', 'No'])], ctx, { allowLlm: false });
    expect(r.instructions[0]?.value).toBe('Yes');
  });
});

describe('yes/no questions about a detail you have', () => {
  it('answers "Do you have a PAN card?" with Yes, not the number', async () => {
    const { answers, engine } = make();
    answers.remember('What is my PAN number?', 'ABCDE1234F', AnswerSource.EXCEL);
    const r = await engine.resolve([field('Do you have a Permanent Account Number (PAN) Card?')], ctx, { allowLlm: false });
    expect(r.instructions[0]?.value).toBe('Yes');
  });

  it('answers "Do you have a LinkedIn profile?" with Yes and the link', async () => {
    const { engine } = make();
    const text = await engine.resolve([field('Do u have LinkdeIn profile?', FieldKind.TEXTAREA)], ctx, { allowLlm: false });
    expect(text.instructions[0]?.value).toBe('Yes - https://www.linkedin.com/in/priya');
    const radio = await engine.resolve([field('Do you have a LinkedIn profile?', FieldKind.RADIO, ['Yes', 'No'])], ctx, { allowLlm: false });
    expect(radio.instructions[0]?.value).toBe('Yes');
  });
});
