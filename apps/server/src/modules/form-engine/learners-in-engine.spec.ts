// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

// How the learners change what Sudarshan does (2026-09-30): only once proven, and checked while not.

import { EventsService } from '../../common/events/events.service';
import { StorageService } from '../../common/storage/storage.service';
import { AnswersService } from '../answers/answers.service';
import { JobPlatform } from '../jobs/enums/job-platform.enum';
import { JobsService } from '../jobs/jobs.service';
import { FieldLearnerService } from '../learners/field-learner.service';
import { LearnerMode } from '../learners/enums/learner-mode.enum';
import { LlmService } from '../llm/llm.service';
import { EMPTY_PROFILE } from '../profile/constants/profile.constants';
import { AnswerEngineService } from './answer-engine.service';
import { FieldKind } from './enums/field-kind.enum';
import { AnswerContext } from './interfaces/answer-context.interface';
import { FormField } from './interfaces/form-field.interface';

const field = (label: string): FormField => ({
  id: 'f',
  kind: FieldKind.TEXT,
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
  profile: { ...EMPTY_PROFILE, phone: '9876543210', country: 'India' },
  job: { id: 1, title: 'x', company: 'x', location: 'Noida', description: '' },
  resumePath: null,
  skillYears: () => null,
};

/** A field learner in a given mode that recognises "Contact No" as your phone; records what it is asked. */
const learner = (mode: LearnerMode) => {
  const calls = { observed: [] as string[], checks: [] as string[], finished: [] as string[] };
  const l = {
    mode: () => mode,
    observe: (label: string, key: string) => calls.observed.push(`${label}=${key}`),
    predict: async (label: string) => (/contact no/i.test(label) ? { label: 'phone', agreement: 1, similarity: 0.99, nearest: 'Phone number' } : null),
    startCheck: (label: string) => (calls.checks.push(label), 7),
    finishCheck: (_id: number, _c: AnswerContext, _f: FormField, key: string, value: string) => calls.finished.push(`${key}:${value}`),
  } as unknown as FieldLearnerService;
  return { l, calls };
};
const ai = (answer: string) =>
  ({
    isAvailable: () => true,
    json: async (prompt: string) => ({ answers: [{ id: /QUESTIONS\n.*"id":"(\w+)"/.exec(prompt)?.[1] ?? 'f', value: answer, confident: true }] }),
  }) as unknown as LlmService;

describe('the field learner in the answer engine', () => {
  it('fills a field it recognises, once proven', async () => {
    const { l } = learner(LearnerMode.ON);
    const engine = new AnswerEngineService(new AnswersService(new StorageService(':memory:')), ai('should not be asked'), undefined, l);
    const r = await engine.resolve([field('Contact No')], ctx, { allowLlm: true });
    expect(r.instructions[0]?.value).toBe('9876543210');
    expect(r.stats).toMatchObject({ learnedHits: 1, llmCalls: 0 });
  });

  it('while checking itself, fills nothing - its guess is marked by the answer the field gets', async () => {
    const { l, calls } = learner(LearnerMode.CHECKING);
    const engine = new AnswerEngineService(new AnswersService(new StorageService(':memory:')), ai('9876543210'), undefined, l);
    const r = await engine.resolve([field('Contact No')], ctx, { allowLlm: true });
    expect(r.stats.learnedHits).toBeUndefined();
    expect(r.stats.llmCalls).toBe(1);
    expect(calls.checks).toEqual(['Contact No']);
    expect(calls.finished).toEqual(['phone:9876543210']);
  });

  it('learns from every field a rule fills with one of your details', async () => {
    const { l, calls } = learner(LearnerMode.LEARNING);
    const engine = new AnswerEngineService(new AnswersService(new StorageService(':memory:')), ai(''), undefined, l);
    await engine.resolve([field('Mobile number')], ctx, { allowLlm: false });
    expect(calls.observed).toEqual(['Mobile number=phone']);
  });
});

describe('the outcome learner in the queue', () => {
  it('puts likely successes first within a score band - never ahead of a clearly better job', () => {
    const storage = new StorageService(':memory:');
    const jobs = new JobsService(storage, new EventsService());
    const now = new Date().toISOString();
    const add = (id: number, score: number, chance: number | null) =>
      storage.run(
        `INSERT INTO jobs (id, source, external_id, url, title, company, status, score, success_chance, discovered_at, updated_at)
         VALUES (?, 'linkedin', ?, ?, 'Backend', 'Acme', 'approved', ?, ?, ?, ?)`,
        [id, `j${id}`, `https://www.linkedin.com/jobs/view/${id}/`, score, chance, now, now],
      );
    add(1, 84, 0.2);
    add(2, 82, 0.9);
    add(3, 95, 0.1);
    expect(jobs.nextToApply([JobPlatform.LINKEDIN])?.id).toBe(3);
    storage.run('UPDATE jobs SET status = ? WHERE id = 3', ['applied']);
    // 84 and 82 are the same band: the one likely to go through first.
    expect(jobs.nextToApply([JobPlatform.LINKEDIN])?.id).toBe(2);
  });
});
