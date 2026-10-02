// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { FieldKind } from '../../form-engine/enums/field-kind.enum';
import { FormField } from '../../form-engine/interfaces/form-field.interface';
import { toInstruction } from '../../form-engine/utils/field-value.util';
import { asChoiceQuestion, boxesToTick } from './naukri-choices.util';

const box = (id: string, label: string): FormField => ({
  id,
  kind: FieldKind.CHECKBOX,
  label,
  name: '',
  placeholder: '',
  required: false,
  value: 'false',
  options: [],
  optionIds: [],
  error: '',
  maxLength: null,
  min: null,
  max: null,
  accept: null,
});

describe("Naukri's checkbox questions (2026-10-01)", () => {
  const boxes = [box('b1', 'React JS'), box('b2', 'Angular'), box('b3', 'Vue JS'), box('b4', 'NO')];
  const question = asChoiceQuestion(boxes, 'Exp. front-end applications using React / Angular / Vue');

  it('reads the boxes as one question with their choices', () => {
    expect(question.kind).toBe(FieldKind.CHECKBOX_GROUP);
    expect(question.label).toMatch(/front-end applications/);
    expect(question.options).toEqual(['React JS', 'Angular', 'Vue JS', 'NO']);
  });

  it('ticks the chosen boxes, never "NO" beside a real choice', () => {
    const ins = toInstruction(question, 'React JS | Angular | Vue JS | NO')!;
    expect(boxesToTick(ins, boxes).map((i) => i.id)).toEqual(['b1', 'b2', 'b3']);
  });

  it('ticks "NO" when that is the only answer', () => {
    const ins = toInstruction(question, 'NO')!;
    expect(boxesToTick(ins, boxes).map((i) => i.id)).toEqual(['b4']);
  });

  it('answers a Yes/NO pair with one box, not both', () => {
    const pair = [box('y', 'Yes'), box('n', 'NO')];
    const ins = toInstruction(asChoiceQuestion(pair, 'are you ok?'), 'Yes | NO')!;
    expect(boxesToTick(ins, pair).map((i) => i.id)).toEqual(['y']);
  });

  it('never turns a saved "true" or "false" into ticks - they are no choice', () => {
    const cities = [box('c1', 'Mumbai'), box('c2', 'Thane'), box('c3', 'Navi Mumbai')];
    expect(toInstruction(asChoiceQuestion(cities, 'Please select the city you are residing in'), 'false')).toBeNull();
  });
});
