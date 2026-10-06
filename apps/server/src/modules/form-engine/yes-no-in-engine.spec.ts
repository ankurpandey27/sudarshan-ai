// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { StorageService } from '../../common/storage/storage.service';
import { AnswersService } from '../answers/answers.service';
import { LlmService } from '../llm/llm.service';
import { EMPTY_PROFILE } from '../profile/constants/profile.constants';
import { AnswerEngineService } from './answer-engine.service';
import { FieldKind } from './enums/field-kind.enum';
import { AnswerContext } from './interfaces/answer-context.interface';
import { FormField } from './interfaces/form-field.interface';

// LinkedIn, Book An Artist (2026-10-06): "Yes" in a numbers-only box came back "Invalid input", twice.
const rejected = (label: string, value: string): FormField => ({
  id: 'f1',
  kind: FieldKind.TEXT,
  label,
  name: '',
  placeholder: '',
  required: true,
  value,
  options: [],
  optionIds: [],
  error: 'Invalid input',
  maxLength: 20,
  min: null,
  max: null,
  accept: null,
});

const ctx = (noticePeriodDays: number | null): AnswerContext => ({
  profile: { ...EMPTY_PROFILE, country: 'India', noticePeriodDays },
  job: { id: 1, title: 'Senior Backend Developer', company: 'Acme', location: 'Remote', description: '' },
  resumePath: null,
  skillYears: () => null,
});

describe('a yes/no answer the site rejected in a numbers-only box', () => {
  const engine = () => new AnswerEngineService(new AnswersService(new StorageService(':memory:')), { isAvailable: () => true } as unknown as LlmService);
  const question = "We must fill this position urgently. Can you start immediately within 30 days' notice?";

  it('is answered again with the number the question means - here your notice period - without asking the AI', async () => {
    const result = await engine().resolve([rejected(question, 'Yes')], ctx(30), { allowLlm: true, force: new Set(['f1']) });
    expect(result.instructions.map((ins) => ins.value)).toEqual(['30']);
    expect(result.stats.llmCalls ?? 0).toBe(0);
  });

  it('a plain yes/no question becomes 1 or 0', async () => {
    const result = await engine().resolve([rejected('Are you willing to relocate to Pune?', 'Yes')], ctx(30), { allowLlm: false, force: new Set(['f1']) });
    expect(result.instructions.map((ins) => ins.value)).toEqual(['1']);
  });
});
