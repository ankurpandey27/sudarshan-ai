// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { StorageService } from '../../common/storage/storage.service';
import { AnswersService } from '../answers/answers.service';
import { AnswerSource } from '../answers/enums/answer-source.enum';
import { LlmService } from '../llm/llm.service';
import { EMPTY_PROFILE } from '../profile/constants/profile.constants';
import { capAttempts } from '../apply/utils/attempt-cap.util';
import { NEW_QUESTIONS } from '../apply/constants/apply.constants';
import { JobStatus } from '../jobs/enums/job-status.enum';
import { AnswerEngineService } from './answer-engine.service';
import { FieldKind } from './enums/field-kind.enum';
import { AnswerContext } from './interfaces/answer-context.interface';
import { FormField } from './interfaces/form-field.interface';

// The BambooHR form of 2026-10-02: six questions only you could answer were asked two at a time, over three tries,
// and the third try sent the job to "Do by hand".
const text = (id: string, label: string): FormField => ({
  id,
  kind: FieldKind.TEXTAREA,
  label,
  name: '',
  placeholder: '',
  required: true,
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
  profile: { ...EMPTY_PROFILE, country: 'India' },
  job: { id: 2082, title: 'Developer', company: 'Marrina Decisions', location: 'Remote', description: '' },
  resumePath: null,
  skillYears: () => null,
};

describe('asking you everything at once (BambooHR, 2026-10-02)', () => {
  it('never lets the AI guess your preferences - they are asked with the rest, in one go', async () => {
    const office = text('a', 'Do you have a dedicated home office with a stable connection?');
    const shift = text('b', 'Are you open to work from home (night shift)?');
    const contract = text('c', 'Are you open to a contract role?');
    const llm = {
      isAvailable: () => true,
      json: async () => ({
        answers: [
          { id: 'a', value: '', basis: 'unknown' },
          { id: 'b', value: 'Yes', basis: 'inferred' },
          { id: 'c', value: 'Yes', basis: 'inferred' },
        ],
      }),
    } as unknown as LlmService;
    const res = await new AnswerEngineService(new AnswersService(new StorageService(':memory:')), llm).resolve([office, shift, contract], ctx, { allowLlm: true });
    expect(res.unresolved.map((u) => u.field.id)).toEqual(['a', 'b', 'c']);
  });

  it("keeps the AI's answers for the next try of the job, so answering you does not turn up new questions", async () => {
    const us = text('a', 'Have you worked with US or Global clients?');
    const b2b = text('b', 'Have you worked for big enterprise in B2B?');
    const startup = text('c', 'Have you worked in any start up?');
    let calls = 0;
    const llm = {
      isAvailable: () => true,
      // First try: unsure only about US clients. Asked again, it would be unsure about the others instead.
      json: async () => {
        calls++;
        return calls === 1
          ? { answers: [{ id: 'a', value: '', basis: 'unknown' }, { id: 'b', value: 'Yes', basis: 'fact' }, { id: 'c', value: 'Yes', basis: 'fact' }] }
          : { answers: [{ id: 'b', value: '', basis: 'unknown' }, { id: 'c', value: '', basis: 'unknown' }] };
      },
    } as unknown as LlmService;
    const answers = new AnswersService(new StorageService(':memory:'));
    const engine = new AnswerEngineService(answers, llm);
    const first = await engine.resolve([us, b2b, startup], ctx, { allowLlm: true });
    expect(first.unresolved.map((u) => u.field.id)).toEqual(['a']);

    // You answer it; the next try fills everything, without asking the AI again.
    answers.remember(us.label, 'Yes - Acme Inc.', AnswerSource.USER, FieldKind.TEXTAREA);
    const second = await engine.resolve([us, b2b, startup], ctx, { allowLlm: true });
    expect(second.unresolved).toEqual([]);
    expect(second.instructions.map((i) => i.id).sort()).toEqual(['a', 'b', 'c']);
    expect(calls).toBe(1);
  });

  it('a try that stopped for questions never asked before is not a failed try', () => {
    const waiting = { status: JobStatus.NEEDS_INPUT, detail: '2 question(s) need your answer' };
    expect(capAttempts({ ...waiting, ended: NEW_QUESTIONS }, 5).status).toBe(JobStatus.NEEDS_INPUT);
    // The same questions back again after you answered: that counts, so the queue never loops.
    expect(capAttempts({ ...waiting, ended: 'run:needs_input' }, 2).status).toBe(JobStatus.MANUAL);
  });
});
