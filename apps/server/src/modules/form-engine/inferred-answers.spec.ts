// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { StorageService } from '../../common/storage/storage.service';
import { AnswersService } from '../answers/answers.service';
import { LlmService } from '../llm/llm.service';
import { EMPTY_PROFILE } from '../profile/constants/profile.constants';
import { AnswerEngineService } from './answer-engine.service';
import { HIGH_STAKES_QUESTION } from './constants/inference.constants';
import { FieldKind } from './enums/field-kind.enum';
import { AnswerContext } from './interfaces/answer-context.interface';
import { FormField } from './interfaces/form-field.interface';

let n = 0;
const q = (label: string, kind = FieldKind.RADIO, options = ['Yes', 'No']): FormField => ({
  id: `f${++n}`,
  kind,
  label,
  name: '',
  placeholder: '',
  required: true,
  value: '',
  options: kind === FieldKind.RADIO ? options : [],
  optionIds: kind === FieldKind.RADIO ? options.map((_, i) => `o${i}`) : [],
  error: '',
  maxLength: null,
  min: null,
  max: null,
  accept: null,
});
const ctx: AnswerContext = {
  profile: { ...EMPTY_PROFILE, country: 'India', city: 'Noida' },
  job: { id: 1, title: 'Backend', company: 'Planet Group', location: 'Noida', description: '' },
  resumePath: null,
  skillYears: () => null,
};

describe('answers worked out from your profile (2026-09-30)', () => {
  it('uses inferred answers to low-stakes questions, asks you the high-stakes ones and your preferences', async () => {
    const employed = q('Have you previously been employed by a Planet Group Company?');
    const drugTest = q('Are you willing to take a drug test?');
    const lambda = q('How many years of experience do you have with AWS Lambda?', FieldKind.NUMBER);
    const salary = q('What gross monthly salary in EUR are you looking for?', FieldKind.NUMBER);
    const notice = q('Notice period (days)', FieldKind.NUMBER);
    const referrer = q('Referred by', FieldKind.TEXT);
    const reply = {
      answers: [
        { id: employed.id, value: 'No', basis: 'inferred' },
        { id: drugTest.id, value: 'Yes', basis: 'inferred' },
        { id: lambda.id, value: '4', basis: 'inferred', reusable: true },
        { id: salary.id, value: '4500', basis: 'inferred' },
        { id: notice.id, value: '30', basis: 'inferred' },
        { id: referrer.id, value: '', basis: 'unknown' },
      ],
    };
    const answers = new AnswersService(new StorageService(':memory:'));
    const llm = { isAvailable: () => true, json: async () => reply } as unknown as LlmService;
    const res = await new AnswerEngineService(answers, llm).resolve([employed, drugTest, lambda, salary, notice, referrer], ctx, { allowLlm: true });
    expect(res.instructions.map((i) => i.id).sort()).toEqual([employed.id, lambda.id].sort());
    // "Are you willing to..." is yours to say, like pay and notice: asked once, remembered.
    expect(res.unresolved.map((u) => u.field.id)).toEqual([drugTest.id, salary.id, notice.id, referrer.id]);
    // The AI's suggestion comes along, so you only confirm it.
    expect(res.unresolved[1].suggestion).toBe('4500');
    // Every answer the AI gave here was worked out (one may come from a profile rule first).
    expect(res.stats.inferred).toBe(res.stats.llmAnswers);
    // Worked out, not stated by you: never saved as your own answer.
    expect(answers.lookup('How many years of experience do you have with AWS Lambda?')).toBeNull();
  });

  it('models that do not say fact or inference still work as before', async () => {
    const f = q('Are you open to negotiation?');
    const llm = { isAvailable: () => true, json: async () => ({ answers: [{ id: f.id, value: 'Yes', confident: true }] }) } as unknown as LlmService;
    const res = await new AnswerEngineService(new AnswersService(new StorageService(':memory:')), llm).resolve([f], ctx, { allowLlm: true });
    expect(res.instructions).toHaveLength(1);
  });

  it.each([
    'How would you rate your English communication skills?',
    'Hoe vaardig bent u in het Nederlands?',
    'Do you have any relatives that are currently employed by ABC Fitness?',
    'Phone Device Type',
    'Open to hybrid mode of work? (2 days office, 3 days WFH)',
    'Describe a specific workflow you automated with AI tooling in the last 6 months.',
  ])('"%s" is low-stakes', (label) => expect(HIGH_STAKES_QUESTION.test(label)).toBe(false));

  it.each([
    'We offer a gross monthly salary in EUR. What salary range are you looking for?',
    'Indique aspiracion renta liquida (salary)',
    'Earliest start date',
    'Do you require visa sponsorship?',
    'Are you willing to relocate to Amsterdam?',
    'I certify that the information provided is true',
  ])('"%s" is high-stakes', (label) => expect(HIGH_STAKES_QUESTION.test(label)).toBe(true));
});
