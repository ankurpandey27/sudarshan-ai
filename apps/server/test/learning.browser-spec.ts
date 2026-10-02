// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { join } from 'node:path';
import puppeteer, { Browser, Page } from 'puppeteer-core';
import { EventsService } from '../src/common/events/events.service';
import { StorageService } from '../src/common/storage/storage.service';
import { AnswersService } from '../src/modules/answers/answers.service';
import { GENERIC_SUCCESS, INDEED_SUCCESS, LINKEDIN_SCOPE } from '../src/modules/apply/constants/apply.constants';
import { findBrowserExecutable } from '../src/modules/browser/utils/browser-executable.util';
import { AnswerEngineService } from '../src/modules/form-engine/answer-engine.service';
import { FormRunnerService } from '../src/modules/form-engine/form-runner.service';
import { PlaybookService } from '../src/modules/form-engine/playbook.service';
import { RecipesService } from '../src/modules/form-engine/recipes.service';
import { JobSource } from '../src/modules/jobs/enums/job-source.enum';
import { JobStatus } from '../src/modules/jobs/enums/job-status.enum';
import { JobsService } from '../src/modules/jobs/jobs.service';
import { LearningService } from '../src/modules/learning/learning.service';
import { LlmService } from '../src/modules/llm/llm.service';
import { WidgetRecipesService } from '../src/modules/form-engine/widget-recipes.service';
import { FillMethod } from '../src/modules/form-engine/enums/fill-method.enum';

const FIXTURE = `file://${join(__dirname, 'fixtures', 'easy-apply-2026.html').replace(/\\/g, '/')}`;
const noLlm = { isConfigured: () => false, isAvailable: () => false } as unknown as LlmService;
const until = async (check: () => boolean, ms = 8000) => {
  for (const end = Date.now() + ms; Date.now() < end;) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
};

describe('Learning from the user (real browser)', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    const executablePath = findBrowserExecutable();
    if (!executablePath) throw new Error('Chrome/Edge not found - browser tests need one installed');
    browser = await puppeteer.launch({ executablePath, headless: true, args: ['--allow-file-access-from-files'] });
  });

  afterAll(async () => {
    await browser?.close();
  });

  it('remembers the answers and steps of a form the user finished by hand, and marks it applied', async () => {
    const storage = new StorageService(':memory:');
    const events = new EventsService();
    const answers = new AnswersService(storage);
    const recipes = new RecipesService(storage);
    const jobs = new JobsService(storage, events);
    const playbook = new PlaybookService(storage);
    const runner = new FormRunnerService(new AnswerEngineService(answers, noLlm), recipes, noLlm, playbook);
    const learning = new LearningService(runner, answers, recipes, playbook, jobs, events);
    const [jobId] = jobs.saveDiscovered([
      {
        source: JobSource.LINKEDIN,
        externalId: 'fixture-1',
        url: FIXTURE,
        title: 'Backend Engineer',
        company: 'Acme',
        location: 'Bengaluru',
        isRemote: false,
        easyApply: true,
        description: '',
      },
    ]);

    page = await browser.newPage();
    await page.goto(FIXTURE);
    await page.click('#easy');
    await learning.watch(page, {
      jobId,
      jobLabel: 'Backend Engineer @ Acme',
      domain: 'fixture.local',
      scopeSelector: LINKEDIN_SCOPE,
      successPattern: /application was sent/i,
    });

    // The site fills the phone in by itself (as from a saved profile) - that is not the user's answer.
    await page.evaluate(() => {
      const tel = document.querySelector<HTMLInputElement>('input[type=tel]')!;
      tel.value = '9999999999';
      tel.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // The user, with real keystrokes and clicks.
    await page.click('[data-next]');
    await page.waitForSelector('[data-step="2"]:not([hidden])');
    await page.click('[role=radio]:first-child');
    await page.type('section[data-step="2"] input[type=text]', '4');
    await page.click('#submit');

    await until(() => jobs.get(jobId).status === JobStatus.APPLIED);
    expect(jobs.get(jobId).status).toBe(JobStatus.APPLIED);
    expect(answers.lookup('Mobile phone number')).toBeNull();
    expect(answers.lookup("Are you comfortable commuting to this job's location?")?.answer).toBe('Yes');
    expect(answers.lookup('How many years of work experience do you have with React?')?.answer).toBe('4');
    expect(recipes.get('fixture.local').advanceTexts).toContain('next');
    await page.close();
  });

  /** Everything a hand-over needs, on a fresh database. */
  const handover = () => {
    const storage = new StorageService(':memory:');
    const events = new EventsService();
    const answers = new AnswersService(storage);
    const recipes = new RecipesService(storage);
    const jobs = new JobsService(storage, events);
    const playbook = new PlaybookService(storage);
    const runner = new FormRunnerService(new AnswerEngineService(answers, noLlm), recipes, noLlm, playbook);
    const learning = new LearningService(runner, answers, recipes, playbook, jobs, events);
    const url = `file://${join(__dirname, 'fixtures', 'handover-step1.html').replace(/\\/g, '/')}`;
    const [jobId] = jobs.saveDiscovered([
      {
        source: JobSource.LINKEDIN,
        externalId: 'handover-' + Math.random(),
        url,
        title: 'Backend Engineer',
        company: 'Acme',
        location: 'Pune',
        isRemote: false,
        easyApply: false,
        description: '',
      },
    ]);
    jobs.setStatus(jobId, JobStatus.MANUAL, 'No way forward found - finish it in the open tab');
    const target = { jobId, jobLabel: 'Backend Engineer @ Acme', domain: 'careers.acme.example', scopeSelector: null, successPattern: GENERIC_SUCCESS };
    return { storage, answers, jobs, playbook, recipes, learning, url, jobId, target };
  };

  it('learns what you do an hour later: two pages, other tabs busy meanwhile, then confirmed (2026-09-30)', async () => {
    const { storage, answers, jobs, learning, url, jobId, target } = handover();
    page = await browser.newPage();
    await page.goto(url);
    await learning.watch(page, target);

    // Sudarshan moves on: another tab is busy for a long while (an hour, in real life; a minute here).
    const other = await browser.newPage();
    await other.setContent('<input id="q"><button>Next</button>');
    for (let i = 0; i < 6; i++) {
      await other.type('#q', 'something else ');
      await new Promise((r) => setTimeout(r, 10_000));
    }
    await other.close();

    // You come back and finish it, with real keystrokes. Page 1:
    await page.type('input[name=fullname]', 'Priya Sharma');
    await page.type('input[name=phone]', '9876543210');
    await page.type('input[name=pw]', 'S3cret-pass!');
    await Promise.all([page.waitForNavigation(), page.click('button[type=submit]')]);
    // Page 2, a new page in the same tab:
    await page.type('input[name=notice]', '30');
    await page.click('input[name=relocate][value=Yes]');
    await page.type('input[name=otp]', '482913');
    await Promise.all([page.waitForNavigation(), page.click('button[type=submit]')]);

    await until(() => jobs.get(jobId).status === JobStatus.APPLIED, 20_000);
    expect(jobs.get(jobId).status).toBe(JobStatus.APPLIED);
    expect(jobs.get(jobId).reason).toMatch(/^Finished by you/);
    // Your answers, from both pages.
    expect(answers.lookup('Full name')?.answer).toBe('Priya Sharma');
    expect(answers.lookup('Phone number')?.answer).toBe('9876543210');
    expect(answers.lookup('What is your notice period in days?')?.answer).toBe('30');
    expect(answers.lookup('Are you willing to relocate to Pune?')?.answer).toBe('Yes');
    // Never: what the site filled in, a password, a one-time code.
    expect(answers.lookup('Email')).toBeNull();
    expect(answers.lookup('Create a password (optional)')).toBeNull();
    expect(answers.lookup('Enter the OTP sent to your phone')).toBeNull();
    // The buttons that got it through, learned because the site confirmed it.
    const steps = storage.all<{ action: string; ok: number }>("SELECT action, ok FROM playbook_steps WHERE domain = 'careers.acme.example'");
    expect(
      steps
        .filter((x) => x.ok > 0)
        .map((x) => x.action)
        .sort(),
    ).toEqual(['continue', 'submit application']);
    await page.close();
  }, 120_000);

  it('keeps your answers but forgets your buttons when you close the tab without submitting', async () => {
    const { storage, answers, jobs, learning, url, jobId, target } = handover();
    page = await browser.newPage();
    await page.goto(url);
    await learning.watch(page, target);
    await page.type('input[name=fullname]', 'Priya Sharma');
    await page.type('input[name=phone]', '9876543210');
    await Promise.all([page.waitForNavigation(), page.click('button[type=submit]')]);
    await page.type('input[name=notice]', '30');
    // A moment later you change your mind and close the tab.
    await new Promise((r) => setTimeout(r, 1000));
    await page.close();
    await new Promise((r) => setTimeout(r, 1000));
    expect(answers.lookup('Phone number')?.answer).toBe('9876543210');
    expect(answers.lookup('What is your notice period in days?')?.answer).toBe('30');
    expect(storage.all('SELECT action FROM playbook_steps')).toEqual([]);
    expect(jobs.get(jobId).status).toBe(JobStatus.MANUAL);
  });

  it('marks it applied when you submit and the site confirms on a new page (Indeed, 2026-09-28)', async () => {
    const storage = new StorageService(':memory:');
    const events = new EventsService();
    const answers = new AnswersService(storage);
    const recipes = new RecipesService(storage);
    const jobs = new JobsService(storage, events);
    const playbook = new PlaybookService(storage);
    const runner = new FormRunnerService(new AnswerEngineService(answers, noLlm), recipes, noLlm, playbook);
    const learning = new LearningService(runner, answers, recipes, playbook, jobs, events);
    const url = `file://${join(__dirname, 'fixtures', 'indeed-final-step.html').replace(/\\/g, '/')}`;
    const [jobId] = jobs.saveDiscovered([
      {
        source: JobSource.INDEED,
        externalId: 'indeed-1',
        url,
        title: 'Backend Developer',
        company: 'Acme',
        location: 'Noida',
        isRemote: false,
        easyApply: true,
        description: '',
      },
    ]);
    jobs.setStatus(jobId, JobStatus.MANUAL, 'Filled - only the captcha is left');

    page = await browser.newPage();
    await page.goto(url);
    await learning.watch(page, {
      jobId,
      jobLabel: 'Backend Developer @ Acme',
      domain: 'smartapply.indeed.com',
      scopeSelector: null,
      successPattern: INDEED_SUCCESS,
    });

    // Later - after every check made at hand-over time has run - you tick the captcha and press
    // Submit; Indeed loads its confirmation page. Nothing expires: your click starts new checks.
    await new Promise((r) => setTimeout(r, 20_000));
    await page.click('#robot');
    await page.click('#submit');
    await until(() => jobs.get(jobId).status === JobStatus.APPLIED, 15000);
    expect(jobs.get(jobId).status).toBe(JobStatus.APPLIED);
    expect(jobs.get(jobId).reason).toMatch(/^Finished by you/);
    await page.close();
  });
  it('learns how you operate a dropdown the site built itself, and nothing from plain fields', async () => {
    const storage = new StorageService(':memory:');
    const events = new EventsService();
    const answers = new AnswersService(storage);
    const recipes = new RecipesService(storage);
    const jobs = new JobsService(storage, events);
    const playbook = new PlaybookService(storage);
    const widgets = new WidgetRecipesService(storage);
    const runner = new FormRunnerService(new AnswerEngineService(answers, noLlm), recipes, noLlm, playbook);
    const learning = new LearningService(runner, answers, recipes, playbook, jobs, events, widgets);
    const [jobId] = jobs.saveDiscovered([
      { source: JobSource.LINKEDIN, externalId: 'fixture-ways', url: 'https://x.test/ways', title: 'Engineer', company: 'Acme', location: '', isRemote: false, easyApply: false, description: '' },
    ]);
    const url = `file://${join(__dirname, 'fixtures', 'button-dropdown.html').replace(/\\/g, '/')}`;
    page = await browser.newPage();
    await page.goto(url);
    await learning.watch(page, { jobId, jobLabel: 'Engineer @ Acme', domain: 'smartapply.indeed.com', scopeSelector: null, successPattern: GENERIC_SUCCESS });

    // You open the button dropdown, pick "LinkedIn" from its list, and tick a plain radio.
    await page.click('#hear');
    await page.click('.menu li:nth-child(3)');
    await page.click('input[value=n]');
    const count = () => Number(storage.get<{ n: number }>('SELECT COUNT(*) n FROM widget_recipes')?.n ?? 0);
    await until(() => count() > 0);
    const rows = storage.all<{ domain: string; widget: string; method: string; ok: number }>('SELECT domain, widget, method, ok FROM widget_recipes');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ domain: 'smartapply.indeed.com', method: FillMethod.OPEN_PICK, ok: 1 });
    expect(rows[0].widget).toMatch(/^button\|combobox\|/);
    expect(widgets.best('smartapply.indeed.com', rows[0].widget)).toBe(FillMethod.OPEN_PICK);
    await page.close();
  });
});
