// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { StorageService } from '../../../common/storage/storage.service';
import { AnswersService } from '../../answers/answers.service';
import { AnswerSource } from '../../answers/enums/answer-source.enum';
import { experienceFrom } from './experience.util';

// What you typed yourself, by question.
const typed = (answers: Record<string, number>) => (about: (q: string) => boolean) => {
  const hits = Object.entries(answers)
    .filter(([q]) => about(q))
    .map(([, n]) => n);
  return hits.length ? Math.max(...hits) : null;
};

describe('experienceFrom', () => {
  it('takes the highest of what is known: 4.9 from your job dates, 5 typed by you', () => {
    const e = experienceFrom({ profileTotal: 4.9, profileSkill: () => null, yearsYouGave: typed({ 'Total Experience': 5 }) });
    expect(e.total).toBe(5);
  });

  it('takes your own higher years for a skill over the resume reading (MongoDB 0.4 -> 5)', () => {
    const e = experienceFrom({
      profileTotal: 4.9,
      profileSkill: (s) => (s === 'MongoDB' ? 0.4 : null),
      yearsYouGave: typed({ 'How many years of MongoDB experience?': 5, 'Total Experience': 5 }),
    });
    expect(e.skillYears('MongoDB')).toBe(5);
  });

  it('never gives a skill more years than your whole career', () => {
    const e = experienceFrom({ profileTotal: 4.9, profileSkill: () => 20.9, yearsYouGave: () => null });
    expect(e.skillYears('Evaboot')).toBe(4.9);
  });

  it('leaves a skill you never mentioned unknown', () => {
    expect(experienceFrom({ profileTotal: 5, profileSkill: () => null, yearsYouGave: () => null }).skillYears('Kotlin')).toBeNull();
  });
});

describe('yearsYouGave (your saved answers)', () => {
  it('reads "Total Experience: 5" as years, ignores the AI and non-numbers', () => {
    const answers = new AnswersService(new StorageService(':memory:'));
    answers.remember('Total Experience', '5', AnswerSource.USER);
    answers.remember('Total Work Experience', '9', AnswerSource.LLM);
    answers.remember('Total Years of Experience?', 'Yes', AnswerSource.USER);
    answers.remember('Year', '2024', AnswerSource.USER);
    const e = experienceFrom({ profileTotal: 4.9, profileSkill: () => null, yearsYouGave: (about) => answers.yearsYouGave(about) });
    expect(e.total).toBe(5);
  });
});

describe('experienceFrom: a number beats an assumption (2026-09-30)', () => {
  it('uses the years you typed for a skill your resume lists without years', () => {
    const e = experienceFrom({
      profileTotal: 4.9,
      profileSkill: (s) => (s === 'React' ? 4.9 : null),
      statedSkill: () => null,
      yearsYouGave: typed({ 'React / Next.js experience (years)': 2 }),
    });
    expect(e.skillYears('React')).toBe(2);
  });

  it('still takes the higher of two numbers (AWS: 4.9 in your profile, "3" typed)', () => {
    const e = experienceFrom({ profileTotal: 4.9, profileSkill: () => 4.9, statedSkill: () => 4.9, yearsYouGave: typed({ 'AWS experience (years)': 3 }) });
    expect(e.skillYears('AWS')).toBe(4.9);
  });

  it('falls back to your whole career for a listed skill when no number is known anywhere', () => {
    expect(experienceFrom({ profileTotal: 4.9, profileSkill: () => 4.9, statedSkill: () => null, yearsYouGave: () => null }).skillYears('React')).toBe(4.9);
  });
});
