// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

// Optional fields are filled when Sudarshan knows the answer (2026-09-29): a complete application does better.

import { StorageService } from '../../common/storage/storage.service';
import { AnswersService } from '../answers/answers.service';
import { LlmService } from '../llm/llm.service';
import { EMPTY_PROFILE } from '../profile/constants/profile.constants';
import { AnswerEngineService } from './answer-engine.service';
import { FieldKind } from './enums/field-kind.enum';
import { AnswerContext } from './interfaces/answer-context.interface';
import { FormField } from './interfaces/form-field.interface';

const optional = (id: string, label: string, kind = FieldKind.TEXT): FormField => ({
  id,
  kind,
  label,
  name: '',
  placeholder: '',
  required: false,
  value: '',
  options: [],
  optionIds: [],
  error: '',
  maxLength: null,
  min: null,
  max: null,
  accept: null,
});

const ctx: AnswerContext = {
  profile: { ...EMPTY_PROFILE, country: 'India', city: 'Noida', totalYearsExperience: 4.9, githubUrl: 'https://github.com/example' },
  job: { id: 1, title: 'Backend', company: 'Acme', location: 'Noida', description: '' },
  resumePath: null,
  skillYears: () => null,
};

/** An AI that knows the answer to "Highest qualification" from the resume, and not to "Other offers". */
const make = () => {
  const asked: string[] = [];
  const llm = {
    isAvailable: () => true,
    json: async (prompt: string) => {
      const questions = JSON.parse(/QUESTIONS\n(.*)\n/.exec(prompt)![1]) as { id: string; question: string }[];
      asked.push(...questions.map((q) => q.question));
      return {
        answers: questions.map((q) =>
          /qualification/i.test(q.question) ? { id: q.id, value: 'B.Tech', confident: true, reusable: true } : { id: q.id, value: '', confident: false },
        ),
      };
    },
  } as unknown as LlmService;
  const engine = new AnswerEngineService(new AnswersService(new StorageService(':memory:')), llm);
  return { engine, asked };
};

describe('optional fields', () => {
  it('fills an optional field when the answer is known (profile or AI from your resume)', async () => {
    const { engine } = make();
    const r = await engine.resolve([optional('gh', 'GitHub profile'), optional('q', 'Highest qualification')], ctx, { allowLlm: true });
    expect(Object.fromEntries(r.instructions.map((i) => [i.id, i.value]))).toEqual({ gh: 'https://github.com/example', q: 'B.Tech' });
  });

  it('leaves an optional field blank when nothing is known - and never asks you about it', async () => {
    const { engine } = make();
    const r = await engine.resolve([optional('o', 'Details of other offers in hand')], ctx, { allowLlm: true });
    expect(r.instructions).toEqual([]);
    expect(r.unresolved).toEqual([]);
  });

  it('never has the AI fill referrers, diversity questions or newsletter boxes', async () => {
    const { engine, asked } = make();
    await engine.resolve(
      [
        optional('r', 'Referred by (name)'),
        optional('g', 'Gender'),
        optional('v', 'Are you a veteran?'),
        optional('n', 'Send me job alerts', FieldKind.CHECKBOX),
      ],
      ctx,
      { allowLlm: true },
    );
    expect(asked).toEqual([]);
  });

  it('asks the AI once for all fields of a step, required and optional together', async () => {
    const { engine, asked } = make();
    await engine.resolve([{ ...optional('a', 'Why do you want this job?', FieldKind.TEXTAREA), required: true }, optional('q', 'Highest qualification')], ctx, {
      allowLlm: true,
    });
    expect(asked).toEqual(['Why do you want this job?', 'Highest qualification']);
  });
});
