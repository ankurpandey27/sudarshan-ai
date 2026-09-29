// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

// These tests never open a browser; puppeteer-core (ESM-only) cannot load in Jest before Node 24.9.
jest.mock('puppeteer-core', () => ({}));

import { StorageService } from '../../common/storage/storage.service';
import { FormRunOutcome } from '../form-engine/interfaces/form-run.interface';
import { LearnedMove } from '../form-engine/interfaces/learned-move.interface';
import { PlaybookService } from '../form-engine/playbook.service';
import { RecipesService } from '../form-engine/recipes.service';
import { JobPlatform } from '../jobs/enums/job-platform.enum';
import { JobSource } from '../jobs/enums/job-source.enum';
import { JobStatus } from '../jobs/enums/job-status.enum';
import { Job } from '../jobs/interfaces/job.interface';
import { ApplyService } from './apply.service';
import { PrepareStatus } from './enums/prepare-status.enum';
import { PrepareResult } from './interfaces/apply-adapter.interface';

const prep = (p: Partial<PrepareResult> & Pick<PrepareResult, 'status'>): PrepareResult => ({ scopeSelector: null, successPattern: /submitted/i, ...p });

const job = {
  id: 7,
  title: 'Node JS',
  company: 'Infosys',
  platform: JobPlatform.LINKEDIN,
  source: JobSource.LINKEDIN,
  attempts: 0,
  url: 'https://www.linkedin.com/jobs/view/7/',
} as Job;

const SITE = 'careers.acme.com';
const move = (signature: string | null, text: string, by: LearnedMove['by'] = 'rules', kind: LearnedMove['kind'] = 'advance'): LearnedMove => ({
  domain: SITE,
  kind,
  signature,
  text,
  by,
});
const run = (status: FormRunOutcome['status'], moves: LearnedMove[], stuckAt: LearnedMove | null = null): FormRunOutcome => ({
  status,
  detail: status,
  unresolved: [],
  steps: moves.length,
  fields: 0,
  memoryHits: 0,
  profileHits: 0,
  llmCalls: 0,
  moves,
  stuckAt,
});

/** ApplyService with only the parts these tests touch; `first` is what the job's own adapter finds. */
const make = (first: PrepareResult, formRun?: FormRunOutcome) => {
  const markLoggedOut = jest.fn(async () => undefined);
  const setStatus = jest.fn();
  const watch = jest.fn(async () => undefined);
  const coolDown = jest.fn();
  const forgetAttempt = jest.fn();
  const close = jest.fn(async () => undefined);
  const storage = new StorageService(':memory:');
  const playbook = new PlaybookService(storage);
  const recipes = new RecipesService(storage);
  const page = { close, url: () => (formRun ? `https://${SITE}/apply` : 'https://career.infosys.com/login') };
  const service = new ApplyService(
    { matches: () => true, prepare: async () => first } as never,
    { matches: () => false } as never,
    { matches: () => false } as never,
    {
      matches: () => false,
      prepareUrl: async () => prep({ status: PrepareStatus.LOGIN_REQUIRED, detail: 'Log in to career.infosys.com in the agent browser' }),
    } as never,
    { busyWith: (fn: () => unknown) => fn(), newPage: async () => page, screenshot: async () => null, markLoggedOut } as never,
    { run: async () => formRun } as never,
    recipes,
    playbook,
    { startAttempt: () => 1, setStatus, finishAttempt: () => undefined, forgetAttempt } as never,
    { clearForJob: () => undefined, add: () => undefined } as never,
    { yearsYouGave: () => null } as never,
    { get: () => ({}), resumePath: () => null, skillYears: () => null } as never,
    { get: () => ({ sources: { externalSites: { enabled: true } }, agent: { pauseBeforeSubmit: false } }) } as never,
    { emit: () => undefined } as never,
    { watch } as never,
    { state: () => ({ status: 'ok' }), coolDown } as never,
  );
  return { service, markLoggedOut, setStatus, watch, playbook, recipes, coolDown, forgetAttempt, close };
};

describe('ApplyService login pages', () => {
  it("never marks LinkedIn logged out for a company site's login page (Infosys, 2026-09-28)", async () => {
    const { service, markLoggedOut, setStatus, watch } = make(prep({ status: PrepareStatus.EXTERNAL, externalUrl: 'https://career.infosys.com/job/1' }));
    const res = await service.apply(job);
    expect(markLoggedOut).not.toHaveBeenCalled();
    // The open tab is watched, so logging in and finishing it yourself marks it applied.
    expect(watch).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ jobId: job.id, domain: 'career.infosys.com' }));
    // That one job waits for you, with the company's login page open; it does not go back in the queue.
    expect(res.status).toBe(JobStatus.MANUAL);
    expect(setStatus).toHaveBeenLastCalledWith(job.id, JobStatus.MANUAL, 'Log in to career.infosys.com in the agent browser');
  });

  it('still notices when LinkedIn itself logged you out', async () => {
    const { service, markLoggedOut } = make(prep({ status: PrepareStatus.LOGIN_REQUIRED }));
    const res = await service.apply(job);
    expect(markLoggedOut).toHaveBeenCalledWith('linkedin');
    expect(res.status).toBe(JobStatus.APPROVED);
  });
});

describe('ApplyService learns from how an application ends', () => {
  const opened = prep({ status: PrepareStatus.READY, moves: [move(null, 'Apply for this role', 'ai', 'apply')] });

  it('keeps every button of a confirmed application, including the AI picks', async () => {
    const { service, playbook, recipes } = make(opened, run('applied', [move('resume', 'Continue'), move('review', 'Send it', 'ai')]));
    expect((await service.apply(job)).status).toBe(JobStatus.APPLIED);
    expect(playbook.preferred(SITE, 'resume')).toEqual(['continue']);
    expect(playbook.preferred(SITE, 'review')).toEqual(['send it']);
    // The AI's picks join the site's recipe; the rules' own picks need none.
    expect(recipes.get(SITE).applyTexts).toEqual(['apply for this role']);
    expect(recipes.get(SITE).advanceTexts).toEqual(['send it']);
  });

  it('learns nothing good from one that got stuck, and blames only the button that led there (Indeed, 2026-09-28)', async () => {
    // "Go to my jobs" left the form; the page changed, so it looked like progress.
    const { service, playbook, recipes } = make(opened, run('stuck', [move('resume', 'Continue'), move('review', 'Go to my jobs', 'ai')]));
    await service.apply(job);
    expect(playbook.preferred(SITE, 'resume')).toEqual([]);
    expect(playbook.moves(SITE, 'review')).toEqual([{ action: 'go to my jobs', ok: 0, fail: 1 }]);
    expect(recipes.get(SITE)).toMatchObject({ applyTexts: [], advanceTexts: [] });
  });

  it('blames the button whose errors kept coming back, not the step before it', async () => {
    const { service, playbook } = make(opened, run('stuck', [move('resume', 'Continue')], move('questions', 'Next')));
    await service.apply(job);
    expect(playbook.moves(SITE, 'resume')).toEqual([]);
    expect(playbook.moves(SITE, 'questions')).toEqual([{ action: 'next', ok: 0, fail: 1 }]);
  });

  it('learns nothing yet from a hand-over, but passes its steps on in case you finish it', async () => {
    const steps = [move('resume', 'Continue')];
    const { service, playbook, watch } = make(opened, run('captcha', steps));
    await service.apply(job);
    expect(playbook.moves(SITE, 'resume')).toEqual([]);
    expect(watch).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ agentMoves: [opened.moves![0], ...steps] }));
  });
});

describe('ApplyService when a site refuses applications for now (Naukri, 2026-09-29)', () => {
  const naukriJob = { ...job, platform: JobPlatform.NAUKRI, source: JobSource.NAUKRI, attempts: 2 } as Job;
  const refusedDetail = 'Naukri is refusing applications for now ("please try again later") - it stays in the queue';

  it('keeps the job in the queue with its tries, and pauses the site', async () => {
    const { service, setStatus, coolDown, forgetAttempt, watch } = make(prep({ status: PrepareStatus.REFUSED, detail: refusedDetail }));
    const res = await service.apply(naukriJob);
    expect(res.status).toBe(JobStatus.APPROVED);
    expect(setStatus).toHaveBeenLastCalledWith(naukriJob.id, JobStatus.APPROVED, refusedDetail);
    expect(forgetAttempt).toHaveBeenCalledWith(naukriJob.id);
    expect(coolDown).toHaveBeenCalledWith(JobPlatform.NAUKRI, 3 * 60 * 60_000, refusedDetail);
    // Nothing for you to finish in the tab.
    expect(watch).not.toHaveBeenCalled();
  });

  it('does the same when the refusal comes after the questions', async () => {
    const { service, coolDown, forgetAttempt } = make(prep({ status: PrepareStatus.READY }), { ...run('refused', []), detail: refusedDetail });
    expect((await service.apply(naukriJob)).status).toBe(JobStatus.APPROVED);
    expect(forgetAttempt).toHaveBeenCalledWith(naukriJob.id);
    expect(coolDown).toHaveBeenCalled();
  });

  it('never pauses a site for an ordinary stuck application', async () => {
    const { service, coolDown, forgetAttempt } = make(prep({ status: PrepareStatus.READY }), run('stuck', []));
    await service.apply(naukriJob);
    expect(coolDown).not.toHaveBeenCalled();
    expect(forgetAttempt).not.toHaveBeenCalled();
  });
});
