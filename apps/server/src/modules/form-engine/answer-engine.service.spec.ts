// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { StorageService } from '../../common/storage/storage.service';
import { AnswersService } from '../answers/answers.service';
import { AnswerSource } from '../answers/enums/answer-source.enum';
import { LlmService } from '../llm/llm.service';
import { EMPTY_PROFILE } from '../profile/constants/profile.constants';
import { AnswerEngineService } from './answer-engine.service';
import { FieldKind } from './enums/field-kind.enum';
import { AnswerContext } from './interfaces/answer-context.interface';
import { FormField } from './interfaces/form-field.interface';

const field = (label: string, options: string[] = ['Yes', 'No']): FormField => ({
  id: 'f1',
  kind: FieldKind.RADIO,
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

const at = (location: string): AnswerContext => ({
  profile: { ...EMPTY_PROFILE, country: 'India', city: 'Noida', needsSponsorship: false },
  job: { id: 1, title: 'Backend', company: 'Acme', location, description: '' },
  resumePath: null,
  skillYears: () => null,
});

describe('AnswerEngineService', () => {
  const make = () => {
    const answers = new AnswersService(new StorageService(':memory:'));
    const engine = new AnswerEngineService(answers, { isAvailable: () => false } as unknown as LlmService);
    return { answers, engine };
  };

  it('does not reuse a remembered "authorized to work" for a job abroad', async () => {
    const { answers, engine } = make();
    answers.remember('Are you legally authorized to work?', 'Yes', AnswerSource.USER);

    const home = await engine.resolve([field('Are you legally authorized to work?')], at('Noida, India'), { allowLlm: false });
    expect(home.instructions).toHaveLength(1);

    const abroad = await engine.resolve([field('Are you legally authorized to work?')], at('Austin, Texas, United States'), { allowLlm: false });
    expect(abroad.instructions).toHaveLength(0);
    expect(abroad.unresolved).toHaveLength(1);
  });

  it('hands an unlabelled required question over instead of asking it again and again', async () => {
    const { engine } = make();
    const out = await engine.resolve([field('Choose an option', ['Option A', 'Option B'])], at('Noida, India'), { allowLlm: false });
    expect(out.unresolved).toHaveLength(0);
    expect(out.blockers.join()).toMatch(/no label/);
  });
});
