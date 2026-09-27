// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { join } from 'node:path';
import puppeteer, { Browser, Page } from 'puppeteer-core';
import { EventsService } from '../src/common/events/events.service';
import { StorageService } from '../src/common/storage/storage.service';
import { AnswersService } from '../src/modules/answers/answers.service';
import { LINKEDIN_SCOPE } from '../src/modules/apply/constants/apply.constants';
import { findBrowserExecutable } from '../src/modules/browser/utils/browser-executable.util';
import { AnswerEngineService } from '../src/modules/form-engine/answer-engine.service';
import { FormRunnerService } from '../src/modules/form-engine/form-runner.service';
import { RecipesService } from '../src/modules/form-engine/recipes.service';
import { JobSource } from '../src/modules/jobs/enums/job-source.enum';
import { JobStatus } from '../src/modules/jobs/enums/job-status.enum';
import { JobsService } from '../src/modules/jobs/jobs.service';
import { LearningService } from '../src/modules/learning/learning.service';
import { LlmService } from '../src/modules/llm/llm.service';

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
    const runner = new FormRunnerService(new AnswerEngineService(answers, noLlm), recipes, noLlm);
    const learning = new LearningService(runner, answers, recipes, jobs, events);
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
});
