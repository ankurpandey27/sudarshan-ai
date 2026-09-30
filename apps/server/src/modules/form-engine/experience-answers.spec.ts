// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

// Answers about experience and personal details, from the cases seen on 2026-09-29.

import { StorageService } from '../../common/storage/storage.service';
import { AnswersService } from '../answers/answers.service';
import { AnswerSource } from '../answers/enums/answer-source.enum';
import { LlmService } from '../llm/llm.service';
import { EMPTY_PROFILE } from '../profile/constants/profile.constants';
import { AnswerEngineService } from './answer-engine.service';
import { FieldKind } from './enums/field-kind.enum';
import { AnswerContext } from './interfaces/answer-context.interface';
import { FormField } from './interfaces/form-field.interface';

const text = (label: string, kind = FieldKind.TEXT): FormField => ({
  id: 'f1',
  kind,
  label,
  name: '',
  placeholder: '',
  required: true,
  value: '',
  options: kind === FieldKind.RADIO ? ['Yes', 'No'] : [],
  optionIds: kind === FieldKind.RADIO ? ['o0', 'o1'] : [],
  error: '',
  maxLength: null,
  min: null,
  max: null,
  accept: null,
});

// Like your profile: 4.9 years from your job dates; MySQL 4.4 and PostgreSQL 4.9; Node.js 4.9.
const years: Record<string, number> = { 'node.js': 4.9, mysql: 4.4, postgresql: 4.9, python: 0.9 };
const ctx: AnswerContext = {
  profile: { ...EMPTY_PROFILE, country: 'India', city: 'Noida', totalYearsExperience: 4.9 },
  job: { id: 1, title: 'Backend', company: 'Acme', location: 'Noida', description: '' },
  resumePath: null,
  // SQL counts MySQL and PostgreSQL (the profile's related-skill lookup).
  skillYears: (s) => (s.toLowerCase() === 'sql' ? 4.9 : (years[s.toLowerCase()] ?? null)),
};

const make = () => {
  const answers = new AnswersService(new StorageService(':memory:'));
  const engine = new AnswerEngineService(answers, { isAvailable: () => false } as unknown as LlmService);
  const answer = async (f: FormField) => (await engine.resolve([f], ctx, { allowLlm: false })).instructions[0]?.value;
  return { answers, answer };
};

describe('experience answers', () => {
  it('says 5 years, not 4, for 4.9 years', async () => {
    const { answer } = make();
    expect(await answer(text('Total Experience (in years)'))).toBe('5');
    expect(await answer(text('How many years of experience do you have with Node.js?'))).toBe('5');
  });

  it('never answers 0 for SQL when you have MySQL and PostgreSQL', async () => {
    const { answer } = make();
    expect(await answer(text('How many years of SQL experience do you have?'))).toBe('5');
  });

  it('answers "at least N years" by comparing your years (4.9 counts as 5)', async () => {
    const { answer } = make();
    expect(await answer(text('Do you have minimum 5 years of experience with Node.js?', FieldKind.RADIO))).toBe('Yes');
    expect(await answer(text('Do you have at least 7 years of Node.js experience?', FieldKind.RADIO))).toBe('No');
    // A "how many" question still wants the number.
    expect(await answer(text('How many years of Node.js experience do you have (minimum 3 years)?'))).toBe('5');
  });

  it("never reuses a saved Yes as a number of years, or another skill's years", async () => {
    const { answers, answer } = make();
    answers.remember('How many years of hands-on experience do you have with Kotlin?', 'Yes', AnswerSource.LLM);
    answers.remember('How many years of E-Commerce experience do you have?', '4', AnswerSource.USER);
    // Kotlin is not in the profile, so the saved "Yes" would have been used.
    expect(await answer(text('How many years of hands-on experience do you have with Kotlin?'))).not.toBe('Yes');
    // A different field, worded almost the same: not its number - it is asked instead.
    expect(await answer(text('How many years of Fintech experience do you have?'))).toBeUndefined();
    // The same question still reuses your answer.
    expect(await answer(text('How many years of E-Commerce experience do you have?'))).toBe('4');
  });
});

describe('personal details', () => {
  it('knows your PAN however the form words it', async () => {
    const { answers, answer } = make();
    answers.remember('What is my PAN number?', 'ABCDE1234F', AnswerSource.EXCEL);
    expect(await answer(text('PAN Number (Mandatory for uploading your profile in TCS)'))).toBe('ABCDE1234F');
    expect(await answer(text('Permanent Account Number'))).toBe('ABCDE1234F');
    // "Japan" or "company" are not PAN.
    expect(await answer(text('Have you worked in Japan?'))).not.toBe('ABCDE1234F');
  });

  it('works out your age from your date of birth', async () => {
    const { answers, answer } = make();
    answers.remember('My Date of Birth', '15/03/1995', AnswerSource.USER);
    const now = new Date();
    const expected = now.getFullYear() - 1995 - (now < new Date(now.getFullYear(), 2, 15) ? 1 : 0);
    expect(await answer(text('How old are you?'))).toBe(String(expected));
    expect(await answer(text('Date of birth (DD/MM/YYYY)'))).toBe('15/03/1995');
  });
});
