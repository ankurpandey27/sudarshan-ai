// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { join } from 'node:path';
import puppeteer, { Browser } from 'puppeteer-core';
import { EventsService } from '../src/common/events/events.service';
import { StorageService } from '../src/common/storage/storage.service';
import { AnswersService } from '../src/modules/answers/answers.service';
import { ApplyService } from '../src/modules/apply/apply.service';
import { GENERIC_SUCCESS } from '../src/modules/apply/constants/apply.constants';
import { PrepareStatus } from '../src/modules/apply/enums/prepare-status.enum';
import { findBrowserExecutable } from '../src/modules/browser/utils/browser-executable.util';
import { AnswerEngineService } from '../src/modules/form-engine/answer-engine.service';
import { FormRunnerService } from '../src/modules/form-engine/form-runner.service';
import { PlaybookService } from '../src/modules/form-engine/playbook.service';
import { RecipesService } from '../src/modules/form-engine/recipes.service';
import { JobSource } from '../src/modules/jobs/enums/job-source.enum';
import { JobStatus } from '../src/modules/jobs/enums/job-status.enum';
import { JobsService } from '../src/modules/jobs/jobs.service';
import { LlmService } from '../src/modules/llm/llm.service';
import { EMPTY_PROFILE } from '../src/modules/profile/constants/profile.constants';

const FIXTURE = `file://${join(__dirname, 'fixtures', 'captcha-handover.html').replace(/\\/g, '/')}`;
const noLlm = { isConfigured: () => false, isAvailable: () => false } as unknown as LlmService;

describe('Carrying on after you unblock an application (real browser)', () => {
  let browser: Browser;

  beforeAll(async () => {
    const executablePath = findBrowserExecutable();
    if (!executablePath) throw new Error('Chrome/Edge not found - browser tests need one installed');
    browser = await puppeteer.launch({ executablePath, headless: true, args: ['--allow-file-access-from-files'] });
  });
  afterAll(async () => {
    await browser?.close();
  });

  it('waits while the captcha is there, or while you are busy in the tab - then presses Submit itself', async () => {
    const storage = new StorageService(':memory:');
    const events = new EventsService();
    const jobs = new JobsService(storage, events);
    const recipes = new RecipesService(storage);
    const playbook = new PlaybookService(storage);
    const runner = new FormRunnerService(new AnswerEngineService(new AnswersService(storage), noLlm), recipes, noLlm, playbook);
    let lastActivity = 0;
    const svc = new ApplyService(
      { matches: () => false } as never,
      { matches: () => false } as never,
      { matches: () => false } as never,
      { matches: () => false } as never,
      { busyWith: (fn: () => unknown) => fn(), stepShot: async () => null, screenshot: async () => null } as never,
      runner,
      recipes,
      playbook,
      jobs,
      { clearForJob: () => undefined, add: () => undefined } as never,
      { yearsYouGave: () => null } as never,
      {
        get: () => ({ ...EMPTY_PROFILE, firstName: 'Priya', lastName: 'Sharma' }),
        resumePath: () => null,
        skillYears: () => null,
        statedSkillYears: () => null,
      } as never,
      { get: () => ({ agent: { pauseBeforeSubmit: false, rescue: false }, sources: { externalSites: { enabled: true } } }) } as never,
      events,
      { pause: () => undefined, lastActivity: () => lastActivity, finished: () => false } as never,
      { state: () => ({ status: 'ok' }) } as never,
    );
    const [jobId] = jobs.saveDiscovered([
      {
        source: JobSource.WEB,
        externalId: 'c1',
        url: FIXTURE,
        title: 'Backend Engineer',
        company: 'Acme',
        location: 'Pune',
        isRemote: false,
        easyApply: false,
        description: '',
      },
    ]);
    jobs.setStatus(jobId, JobStatus.MANUAL, 'Filled - only the captcha is left');

    const page = await browser.newPage();
    await page.goto(FIXTURE);
    // Handed over at the captcha (as at the end of an application), a while ago.
    const remember = (svc as unknown as { remember: (...a: unknown[]) => void }).remember.bind(svc);
    remember(jobId, page, { status: PrepareStatus.READY, scopeSelector: null, successPattern: GENERIC_SUCCESS }, { matches: () => false }, [], true);
    (svc as unknown as { tabs: Map<number, { since: number }> }).tabs.get(jobId)!.since = 0;
    expect(svc.openTabs()).toEqual([jobId]);

    // The captcha is still there: not yet.
    expect(await svc.readyToContinue()).toEqual([]);
    await page.evaluate(() => (window as never as { solveCaptcha: () => void }).solveCaptcha());
    // Solved, but you touched the tab a moment ago - you may be pressing Submit yourself: not yet.
    lastActivity = Date.now();
    expect(await svc.readyToContinue()).toEqual([]);
    // You left it: Sudarshan AI carries on.
    lastActivity = Date.now() - 60_000;
    expect(await svc.readyToContinue()).toEqual([jobId]);

    const res = await svc.continue(jobs.get(jobId));
    expect(res.status).toBe(JobStatus.APPLIED);
    // It pressed Submit itself, the site confirmed, and the finished tab was closed.
    const trace = jobs.attempts(jobId)[0].trace;
    expect(trace[0]).toMatch(/Continuing: Backend Engineer @ Acme/);
    expect(trace.some((t) => t.includes('"Submit application"'))).toBe(true);
    expect(page.isClosed()).toBe(true);
    expect(jobs.get(jobId).status).toBe(JobStatus.APPLIED);
    expect(svc.openTabs()).toEqual([]);
  });

  it('never carries on in a tab you closed', async () => {
    const storage = new StorageService(':memory:');
    const jobs = new JobsService(storage, new EventsService());
    const none = { matches: () => false } as never;
    const svc = new ApplyService(none, none, none, none, none, none, none, none, jobs, none, none, none, none, none, none, none);
    const [jobId] = jobs.saveDiscovered([
      { source: JobSource.WEB, externalId: 'c2', url: FIXTURE, title: 'x', company: 'y', location: '', isRemote: false, easyApply: false, description: '' },
    ]);
    const page = await browser.newPage();
    const remember = (svc as unknown as { remember: (...a: unknown[]) => void }).remember.bind(svc);
    remember(jobId, page, { status: PrepareStatus.READY, scopeSelector: null, successPattern: GENERIC_SUCCESS }, {}, [], true);
    await page.close();
    expect(svc.openTabs()).toEqual([]);
  });
});
