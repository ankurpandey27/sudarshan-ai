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

let n = 0;
const field = (label: string, kind: FieldKind, extra: Partial<FormField> = {}): FormField => {
  const options = kind === FieldKind.RADIO ? ['Yes', 'No'] : [];
  return {
    id: `f${++n}`,
    kind,
    label,
    name: '',
    placeholder: '',
    required: false,
    value: '',
    options,
    optionIds: options.map((_, i) => `o${i}`),
    error: '',
    maxLength: null,
    min: null,
    max: null,
    accept: null,
    ...extra,
  };
};
const ctx = (cleanRecord: boolean): AnswerContext => ({
  profile: { ...EMPTY_PROFILE, country: 'India', city: 'Noida', cleanRecord },
  job: { id: 1, title: 'Backend', company: 'Acme', location: 'Noida', description: '' },
  resumePath: 'C:/resume.pdf',
  skillYears: () => null,
});
const engine = () => new AnswerEngineService(new AnswersService(new StorageService(':memory:')), { isAvailable: () => false } as unknown as LlmService);

describe('optional fields a recruiter still looks at (2026-09-30)', () => {
  it('attaches the resume to an optional, vaguely labelled upload - not to the photo field', async () => {
    const photo = field('Profile photo', FieldKind.FILE, { accept: 'image/*' });
    const attach = field('Attachments', FieldKind.FILE);
    const res = await engine().resolve([photo, attach], ctx(false), { allowLlm: false });
    expect(res.instructions.map((i) => [i.id, i.value])).toEqual([[attach.id, 'C:/resume.pdf']]);
  });

  it('answers optional questions about your record as a clean candidate - once you have declared it', async () => {
    const legal = field('Is there any legal action against you from anyone?', FieldKind.RADIO);
    const consent = field('Do you consent to a background verification?', FieldKind.RADIO);
    const declare = field('I confirm that I have no criminal record', FieldKind.CHECKBOX);
    const res = await engine().resolve([legal, consent, declare], ctx(true), { allowLlm: false });
    const got = Object.fromEntries(res.instructions.map((i) => [i.id, i.optionIndexes.length ? ['Yes', 'No'][i.optionIndexes[0]] : i.value]));
    expect(got).toEqual({ [legal.id]: 'No', [consent.id]: 'Yes', [declare.id]: expect.stringMatching(/true|yes/i) });
  });

  it('never claims it for you: without the declaration, an optional one stays blank and a required one is asked', async () => {
    const optional = field('Have you ever been convicted of an offence?', FieldKind.RADIO);
    const required = field('Any pending court case against you?', FieldKind.RADIO, { required: true });
    const res = await engine().resolve([optional, required], ctx(false), { allowLlm: false });
    expect(res.instructions).toEqual([]);
    expect(res.unresolved.map((u) => u.field.id)).toEqual([required.id]);
  });
});
