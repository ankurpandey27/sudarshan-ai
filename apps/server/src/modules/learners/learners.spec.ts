// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { EmbeddingsService } from '../../common/embeddings/embeddings.service';
import { StorageService } from '../../common/storage/storage.service';
import { AnswersService } from '../answers/answers.service';
import { AnswerSource } from '../answers/enums/answer-source.enum';
import { FieldKind } from '../form-engine/enums/field-kind.enum';
import { FormAction } from '../form-engine/interfaces/form-field.interface';
import { EMPTY_PROFILE } from '../profile/constants/profile.constants';
import { ProfileService } from '../profile/profile.service';
import { ButtonLearnerService } from './button-learner.service';
import { LearnerMode } from './enums/learner-mode.enum';
import { LearnerName } from './enums/learner-name.enum';
import { FieldLearnerService } from './field-learner.service';
import { LearnersService } from './learners.service';
import { OutcomeLearnerService } from './outcome-learner.service';

/** A stand-in meaning model: texts sharing a topic word point the same way. No download needed. */
const TOPICS: [string, RegExp][] = [
  ['phone', /phone|mobile|contact no|telefoon|whatsapp/i],
  ['email', /e-?mail|correo/i],
  ['city', /city|location|woonplaats/i],
  ['notice', /notice|join/i],
  ['forward', /next|continue|submit|verder|weiter|apply|review|send|volgende/i],
  ['leave', /cancel|close|back|save and close/i],
];
const fakeModel = {
  embed: async (texts: string[]) =>
    texts.map((t) => {
      const v: number[] = TOPICS.map(([, re]) => (re.test(t) ? 1 : 0));
      // No topic: its own direction, far from everything.
      v.push(v.some((x) => x > 0) ? 0 : 1);
      const n = Math.hypot(...v);
      return Float32Array.from(v.map((x) => x / n));
    }),
} as unknown as EmbeddingsService;

const profile = { ...EMPTY_PROFILE, firstName: 'Priya', lastName: 'Sharma', phone: '9876543210', email: 'priya@example.com', city: 'Noida' };
const field = (label: string) => ({
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
const ctx = { profile, job: { id: 1, title: 'x', company: 'x', location: '', description: '' }, resumePath: null, skillYears: () => null };

const make = () => {
  const storage = new StorageService(':memory:');
  const learners = new LearnersService(storage);
  return { storage, learners, answers: new AnswersService(storage) };
};

describe('LearnersService', () => {
  it('counts a sighting again, but never an example rebuilt from history twice', () => {
    const { learners } = make();
    learners.addExample(LearnerName.FIELD, 'Mobile', 'phone', 'rule');
    learners.addExample(LearnerName.FIELD, 'Mobile', 'phone', 'rule');
    learners.replaceExamples(LearnerName.FIELD, 'history', [{ text: 'Phone', label: 'phone' }]);
    learners.replaceExamples(LearnerName.FIELD, 'history', [{ text: 'Phone', label: 'phone' }]);
    const ex = learners.examples(LearnerName.FIELD);
    expect(ex.find((e) => e.text === 'Mobile')?.seen).toBe(2);
    expect(ex.filter((e) => e.text === 'Phone')).toEqual([expect.objectContaining({ seen: 1 })]);
  });

  it('keeps live checks and reports how the most recent went', () => {
    const { learners } = make();
    for (let i = 0; i < 4; i++) learners.resolve(learners.check(LearnerName.FIELD, `q${i}`, 'phone'), 'x', i < 3);
    learners.check(LearnerName.FIELD, 'open', 'phone');
    expect(learners.live(LearnerName.FIELD)).toMatchObject({ checked: 4, right: 3 });
    expect(learners.openChecks(LearnerName.FIELD).map((c) => c.input)).toEqual(['open']);
  });

  it('lets you switch a learner off', () => {
    const { learners } = make();
    learners.setEnabled(LearnerName.BUTTON, false);
    expect(learners.mode(LearnerName.BUTTON)).toBe(LearnerMode.OFF);
    expect(learners.status().find((s) => s.name === LearnerName.BUTTON)?.enabled).toBe(false);
  });
});

describe('FieldLearnerService', () => {
  const setup = (answered: [string, string][]) => {
    const { storage, learners, answers } = make();
    for (const [q, a] of answered) answers.remember(q, a, AnswerSource.USER);
    const fieldLearner = new FieldLearnerService(learners, fakeModel, storage, { get: () => profile } as unknown as ProfileService);
    return { storage, learners, answers, field: fieldLearner };
  };

  it('learns from your history: wordings the rules know, and ones you answered with your own details', async () => {
    const { learners, field } = setup([
      ['Phone number', '9876543210'],
      ['Contact No', '9876543210'],
      ['Email address', 'priya@example.com'],
    ]);
    await field.train();
    const ex = learners.examples(LearnerName.FIELD);
    expect(ex).toEqual(expect.arrayContaining([expect.objectContaining({ text: 'Contact No', label: 'phone', source: 'you' })]));
    expect(ex).toEqual(expect.arrayContaining([expect.objectContaining({ text: 'Phone number', label: 'phone', source: 'history' })]));
  });

  it('recognises a new wording of one of your details, and is not sure about anything else', async () => {
    const { field } = setup([]);
    for (const l of ['Phone number', 'Mobile number', 'Phone', 'Mobile phone']) field.observe(l, 'phone');
    for (const l of ['Email', 'Email address', 'E-mail']) field.observe(l, 'email');
    await field.train();
    expect((await field.predict('Your WhatsApp number'))?.label).toBe('phone');
    expect(await field.predict('Why do you want this job?')).toBeNull();
  });

  it('marks its quiet prediction right or wrong from the answer the field finally got', async () => {
    const { learners, field } = setup([]);
    const right = field.startCheck('Contact No', 'phone');
    field.finishCheck(right, ctx, fieldNamed('Contact No'), 'phone', '98765 43210');
    const wrong = field.startCheck('Emergency contact', 'phone');
    field.finishCheck(wrong, ctx, fieldNamed('Emergency contact'), 'phone', '9123456789');
    expect(learners.live(LearnerName.FIELD)).toMatchObject({ checked: 2, right: 1 });
  });

  it('stays in checking mode until proven - it never fills fields on a few lucky guesses', async () => {
    const { learners, field } = setup([]);
    for (const l of ['Phone number', 'Mobile number', 'Phone', 'Mobile phone', 'Telephone']) field.observe(l, 'phone');
    await field.train();
    expect(learners.mode(LearnerName.FIELD)).not.toBe(LearnerMode.ON);
  });
});
const fieldNamed = field;

describe('ButtonLearnerService', () => {
  const buttons = (...texts: string[]): FormAction[] => texts.map((text, i) => ({ id: `b${i}`, text, kind: 'other', disabled: false }));

  it('learns forward buttons from confirmed applications and picks one on a new site once on', async () => {
    const { storage, learners } = make();
    const now = new Date().toISOString();
    const forward = ['next', 'continue', 'submit application', 'review', 'send', 'apply now', 'next step', 'continue to review', 'submit', 'apply'];
    forward.forEach((a, i) =>
      storage.run('INSERT INTO playbook_steps (domain, signature, action, ok, fail, updated_at) VALUES (?, ?, ?, 3, 0, ?)', [`s${i}.example`, 'x', a, now]),
    );
    ['cancel', 'close', 'go back'].forEach((a, i) =>
      storage.run('INSERT INTO playbook_steps (domain, signature, action, ok, fail, updated_at) VALUES (?, ?, ?, 0, 2, ?)', [`d${i}.example`, 'x', a, now]),
    );
    const learner = new ButtonLearnerService(learners, fakeModel, storage);
    await learner.train();
    // Not proven yet (few examples): it picks nothing, the AI still decides.
    expect(await learner.pick(buttons('Volgende', 'Annuleren'))).toBeNull();
    // Proven: on a Dutch site it has never seen, "Volgende" (next).
    learners.saveState(LearnerName.BUTTON, { mode: LearnerMode.ON, offline: null, examples: 40, note: '' });
    expect((await learner.pick(buttons('Hulp', 'Volgende')))?.action.text).toBe('Volgende');
    // Never a button that leaves the application.
    expect(await learner.pick(buttons('Save and close'))).toBeNull();
  });
});

describe('OutcomeLearnerService', () => {
  it('learns which applications go through and, once proven, puts them first within a score band', () => {
    const { storage, learners } = make();
    const now = new Date().toISOString();
    const job = (id: number, easy: number, applyUrl: string | null, score: number, status = 'applied') =>
      storage.run(
        `INSERT INTO jobs (id, source, external_id, url, apply_url, title, company, easy_apply, status, score, discovered_at, updated_at)
         VALUES (?, 'linkedin', ?, ?, ?, 'Backend', 'Acme', ?, ?, ?, ?, ?)`,
        [id, `j${id}`, `https://www.linkedin.com/jobs/view/${id}/`, applyUrl, easy, status, score, now, now],
      );
    // Easy Apply goes through; one company's own site always needs you.
    // Enough history that its newest fifth (tested on) is at least 50 attempts.
    for (let i = 1; i <= 300; i++) {
      const easy = i % 2 === 0;
      job(i, easy ? 1 : 0, easy ? null : 'https://careers.hard.example/apply', 80);
      storage.run('INSERT INTO attempts (job_id, started_at, result) VALUES (?, ?, ?)', [i, now, easy ? 'run:applied' : 'run:stuck']);
    }
    job(500, 0, 'https://careers.hard.example/apply', 84, 'approved');
    job(501, 1, null, 82, 'approved');
    new OutcomeLearnerService(learners, storage).train();
    expect(learners.mode(LearnerName.OUTCOME)).toBe(LearnerMode.ON);
    const chance = (id: number) => storage.get<{ c: number }>('SELECT success_chance c FROM jobs WHERE id = ?', [id])!.c;
    expect(chance(501)).toBeGreaterThan(chance(500));
  });
});
