// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { join } from 'node:path';
import puppeteer, { Browser } from 'puppeteer-core';
import { StorageService } from '../src/common/storage/storage.service';
import { AnswersService } from '../src/modules/answers/answers.service';
import { GENERIC_SUCCESS } from '../src/modules/apply/constants/apply.constants';
import { findBrowserExecutable } from '../src/modules/browser/utils/browser-executable.util';
import { AnswerEngineService } from '../src/modules/form-engine/answer-engine.service';
import { FormRunnerService } from '../src/modules/form-engine/form-runner.service';
import { PlaybookService } from '../src/modules/form-engine/playbook.service';
import { RecipesService } from '../src/modules/form-engine/recipes.service';
import { WidgetRecipesService } from '../src/modules/form-engine/widget-recipes.service';
import { clickChoiceNearFieldInPage } from '../src/modules/form-engine/scripts/field-widget.script';
import { LlmService } from '../src/modules/llm/llm.service';
import { EMPTY_PROFILE } from '../src/modules/profile/constants/profile.constants';

const FIXTURE = `file://${join(__dirname, 'fixtures', 'keys-only.html').replace(/\\/g, '/')}`;
const noLlm = { isConfigured: () => false, isAvailable: () => false } as unknown as LlmService;

describe('Checking every fill, and learning how to operate a field (real browser)', () => {
  let browser: Browser;
  beforeAll(async () => {
    const executablePath = findBrowserExecutable();
    if (!executablePath) throw new Error('Chrome/Edge not found - browser tests need one installed');
    browser = await puppeteer.launch({ executablePath, headless: true, args: ['--allow-file-access-from-files'] });
  });
  afterAll(async () => {
    await browser?.close();
  });

  it('notices a field that did not take its answer, finds the way that works, and uses it straight away next time', async () => {
    const storage = new StorageService(':memory:');
    const widgets = new WidgetRecipesService(storage);
    const runner = new FormRunnerService(
      new AnswerEngineService(new AnswersService(storage), noLlm),
      new RecipesService(storage),
      noLlm,
      new PlaybookService(storage),
      undefined,
      undefined,
      widgets,
    );
    const ctx = {
      profile: { ...EMPTY_PROFILE, firstName: 'Priya', lastName: 'Sharma', country: 'India' },
      job: { id: 1, title: 'Backend', company: 'Acme', location: 'Noida', description: '' },
      resumePath: null,
      skillYears: () => null,
    };
    const run = async () => {
      const page = await browser.newPage();
      await page.goto(FIXTURE);
      const steps: string[] = [];
      const out = await runner.run(page, {
        scopeSelector: null,
        successPattern: GENERIC_SUCCESS,
        ctx,
        domain: 'careers.guarded.example',
        allowLlm: false,
        pauseBeforeSubmit: false,
        onStep: (m) => steps.push(m),
      });
      await page.close();
      return { out, steps };
    };

    // First time: the usual fill is thrown away; typing works, and is learned.
    const first = await run();
    expect(first.out.status).toBe('applied');
    expect(first.steps.join('\n')).toMatch(/needed another way to fill - learned for next time/);
    expect(storage.get('SELECT method, ok FROM widget_recipes WHERE ok > 0')).toEqual(expect.objectContaining({ method: 'keys', ok: 1 }));

    // Next time: straight to typing, no failed fill and no recovery.
    const second = await run();
    expect(second.out.status).toBe('applied');
    expect(second.steps.join('\n')).not.toMatch(/another way|could not fill/);
  });

  it('asks the AI how to operate a field when no usual way works, and learns its answer', async () => {
    const storage = new StorageService(':memory:');
    const widgets = new WidgetRecipesService(storage);
    const asked: string[] = [];
    const llm = {
      isAvailable: () => true,
      acceptsImages: () => false,
      json: async (prompt: string) => {
        if (prompt.includes('did not take its answer')) {
          asked.push(prompt);
          return { method: 'keys', text: 'P. Sharma' };
        }
        return { answers: [], confirmed: false };
      },
    } as unknown as LlmService;
    const runner = new FormRunnerService(
      new AnswerEngineService(new AnswersService(storage), llm),
      new RecipesService(storage),
      llm,
      new PlaybookService(storage),
      undefined,
      undefined,
      widgets,
    );
    const page = await browser.newPage();
    // A site that accepts only its own format ("P. Sharma"): anything else is wiped as it is typed.
    await page.setContent(`<form onsubmit="return false"><label for="n">First name *</label><input id="n" required>
      <button type="button" onclick="if(document.getElementById('n').value)document.body.innerHTML='<h1>Thank you for applying!</h1>'">Submit application</button></form>
      <script>const n=document.getElementById('n');n.addEventListener('input',()=>{if(!'P. Sharma'.startsWith(n.value))n.value='';});</script>`);
    const steps: string[] = [];
    const out = await runner.run(page, {
      scopeSelector: null,
      successPattern: GENERIC_SUCCESS,
      ctx: {
        profile: { ...EMPTY_PROFILE, firstName: 'Priya', lastName: 'Sharma', country: 'India' },
        job: { id: 1, title: 'Backend', company: 'Acme', location: 'Noida', description: '' },
        resumePath: null,
        skillYears: () => null,
      },
      domain: 'careers.strict.example',
      allowLlm: true,
      pauseBeforeSubmit: false,
      rescue: false,
      onStep: (m) => steps.push(m),
    });
    await page.close();
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatch(/QUESTION: First name/);
    expect(steps.join('\n')).toMatch(/learned for next time/);
    expect(out.status).toBe('applied');
  });

  it('clicks a choice only within its own question, never another question\'s "Yes"', async () => {
    const page = await browser.newPage();
    await page.goto(`file://${join(__dirname, 'fixtures', 'two-yes.html').replace(/\\/g, '/')}`);
    const storage = new StorageService(':memory:');
    const runner = new FormRunnerService(
      new AnswerEngineService(new AnswersService(storage), noLlm),
      new RecipesService(storage),
      noLlm,
      new PlaybookService(storage),
    );
    const snap = await runner.snapshot(page, null);
    const visa = snap.fields.find((f) => /visa/i.test(f.label))!;
    expect(await page.evaluate(clickChoiceNearFieldInPage, visa.id, 'Yes')).toBe(true);
    const checked = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[role=radiogroup]')).map((g) => g.id + ':' + (g.querySelector('[aria-checked=true]')?.textContent ?? '-')),
    );
    expect(checked).toEqual(['rel:-', 'visa:Yes']);
    await page.close();
  });

  it('answers "Experience working with X?" in a 20-character box with years, reading the counter as its limit (LinkedIn, AppGreat, 2026-10-01)', async () => {
    const page = await browser.newPage();
    await page.goto(`file://${join(__dirname, 'fixtures', 'linkedin-short-answers.html').replace(/\\/g, '/')}`);
    const storage = new StorageService(':memory:');
    const runner = new FormRunnerService(
      new AnswerEngineService(new AnswersService(storage), noLlm),
      new RecipesService(storage),
      noLlm,
      new PlaybookService(storage),
      undefined,
      undefined,
      new WidgetRecipesService(storage),
    );
    const snap = await runner.snapshot(page, null);
    expect(snap.fields.map((f) => f.maxLength)).toEqual([20, 20]);
    const out = await runner.run(page, {
      scopeSelector: null,
      successPattern: GENERIC_SUCCESS,
      ctx: {
        profile: { ...EMPTY_PROFILE, country: 'India', totalYearsExperience: 5 },
        job: { id: 1, title: 'Backend', company: 'AppGreat', location: 'Remote', description: '' },
        resumePath: null,
        skillYears: (s: string) => (/postgres|mysql|mongo/i.test(s) ? 5 : /github actions|circleci|ci\/cd/i.test(s) ? 3 : null),
      },
      domain: 'linkedin.com',
      allowLlm: false,
      pauseBeforeSubmit: false,
      onStep: () => undefined,
    });
    expect(out.status).toBe('applied');
    await page.close();
  });

  it('fills again answers the step emptied when it drew itself again, and sends "30" where "30 days" was rejected (LinkedIn, Somo Media, 2026-10-02)', async () => {
    const page = await browser.newPage();
    await page.goto(`file://${join(__dirname, 'fixtures', 'linkedin-redraw.html').replace(/\\/g, '/')}`);
    const storage = new StorageService(':memory:');
    const runner = new FormRunnerService(
      new AnswerEngineService(new AnswersService(storage), noLlm),
      new RecipesService(storage),
      noLlm,
      new PlaybookService(storage),
      undefined,
      undefined,
      new WidgetRecipesService(storage),
    );
    const steps: string[] = [];
    const out = await runner.run(page, {
      scopeSelector: null,
      successPattern: GENERIC_SUCCESS,
      ctx: {
        profile: { ...EMPTY_PROFILE, country: 'India', currentCtc: 1_200_000, expectedCtc: 1_800_000, noticePeriodDays: 30 },
        job: { id: 1, title: 'Full Stack Developer', company: 'Somo Media', location: 'Delhi', description: '' },
        resumePath: null,
        skillYears: () => null,
      },
      domain: 'linkedin.com',
      allowLlm: false,
      pauseBeforeSubmit: false,
      onStep: (m) => steps.push(m),
    });
    expect(out.status).toBe('applied');
    // Emptied answers are put back (before Review, or after it on the step that comes back), and the notice
    // period goes as the number the box takes.
    expect(await page.evaluate(() => (window as unknown as { __sent: string[] }).__sent)).toEqual(['12', '18', '30']);
    expect(steps.filter((s) => /"Submit application"/.test(s)).length).toBeLessThanOrEqual(2);
    await page.close();
  });

  it('gets another round when the errors change: emptied box first, then "Invalid input" for "30 days" (CodeChavo, 2026-10-05)', async () => {
    const page = await browser.newPage();
    await page.goto(`file://${join(__dirname, 'fixtures', 'linkedin-errors-change.html').replace(/\\/g, '/')}`);
    const storage = new StorageService(':memory:');
    const runner = new FormRunnerService(
      new AnswerEngineService(new AnswersService(storage), noLlm),
      new RecipesService(storage),
      noLlm,
      new PlaybookService(storage),
      undefined,
      undefined,
      new WidgetRecipesService(storage),
    );
    const out = await runner.run(page, {
      scopeSelector: null,
      successPattern: GENERIC_SUCCESS,
      ctx: {
        profile: { ...EMPTY_PROFILE, country: 'India', noticePeriodDays: 30 },
        job: { id: 1, title: 'Node js Developer', company: 'CodeChavo', location: 'Bengaluru', description: '' },
        resumePath: null,
        skillYears: () => null,
      },
      domain: 'linkedin.com',
      allowLlm: false,
      pauseBeforeSubmit: false,
      onStep: () => undefined,
    });
    expect(out.status).toBe('applied');
    expect(await page.evaluate(() => (window as unknown as { __sent: string[] }).__sent)).toEqual(['30']);
    await page.close();
  });
});

describe('Greenhouse-style searchable dropdowns (real browser, Capco 2026-10-03)', () => {
  let browser: Browser;
  beforeAll(async () => {
    const executablePath = findBrowserExecutable();
    if (!executablePath) throw new Error('Chrome/Edge not found - browser tests need one installed');
    browser = await puppeteer.launch({ executablePath, headless: true, args: ['--allow-file-access-from-files'] });
  });
  afterAll(async () => {
    await browser?.close();
  });

  it('names the Education section on vague labels, and answers again a restored school that is not yours', async () => {
    const page = await browser.newPage();
    await page.goto(`file://${join(__dirname, 'fixtures', 'greenhouse-education.html').replace(/\\/g, '/')}`);
    const storage = new StorageService(':memory:');
    const engine = new AnswerEngineService(new AnswersService(storage), noLlm);
    const runner = new FormRunnerService(engine, new RecipesService(storage), noLlm, new PlaybookService(storage));
    const snap = await runner.snapshot(page, null);
    const labels = snap.fields.map((f) => f.label);
    expect(labels).toEqual(expect.arrayContaining(['Education - Start date year', 'Education - End date year']));
    expect(labels.some((l) => /^Phone - /.test(l))).toBe(false);
    const school = snap.fields.find((f) => /school/i.test(f.label))!;
    expect(school.value).toBe('Art Institute of Atlanta');
    const ctx = {
      profile: {
        ...EMPTY_PROFILE,
        country: 'India',
        phone: '9876543210',
        education: [{ degree: 'B.Tech.', field: 'Computer Science', institution: 'Dr. A.P.J. Abdul Kalam Technical University', startYear: 2016, endYear: 2020, grade: '' }],
      },
      job: { id: 1, title: 'Backend', company: 'Capco', location: 'Remote', description: '' },
      resumePath: null,
      skillYears: () => null,
    };
    const res = await engine.resolve(snap.fields, ctx, { allowLlm: false });
    const value = (id: string) => res.instructions.find((i) => i.id === id)?.value;
    // The restored wrong school is answered again with yours; the years come from your education, not your phone.
    expect(value(school.id)).toBe('Dr. A.P.J. Abdul Kalam Technical University');
    expect(value(snap.fields.find((f) => /start date year/i.test(f.label))!.id)).toBe('2016');
    expect(value(snap.fields.find((f) => /end date year/i.test(f.label))!.id)).toBe('2020');
    await page.close();
  });

  it('reads the choice drawn beside an emptied box, and never picks a suggestion that does not match', async () => {
    const page = await browser.newPage();
    await page.goto(`file://${join(__dirname, 'fixtures', 'react-select.html').replace(/\\/g, '/')}`);
    const storage = new StorageService(':memory:');
    const runner = new FormRunnerService(
      new AnswerEngineService(new AnswersService(storage), noLlm),
      new RecipesService(storage),
      noLlm,
      new PlaybookService(storage),
      undefined,
      undefined,
      new WidgetRecipesService(storage),
    );
    const snap = await runner.snapshot(page, null);
    const city = snap.fields.find((f) => /city/i.test(f.label))!;
    const school = snap.fields.find((f) => /school/i.test(f.label))!;
    const steps: string[] = [];
    const ins = [
      { id: city.id, kind: city.kind, value: 'Noida', optionIndexes: [], optionIds: [] },
      { id: school.id, kind: school.kind, value: 'Dr. A.P.J. Abdul Kalam Technical University', optionIndexes: [], optionIds: [] },
    ];
    const held = await runner.fillAndCheck(page, snap, ins, { scopeSelector: null, successPattern: GENERIC_SUCCESS, ctx: {} as never, domain: 'job-boards.greenhouse.io', allowLlm: false, pauseBeforeSubmit: true, onStep: (m) => steps.push(m) }, 1);
    const chosen = await page.evaluate(() => (window as unknown as { __chosen: Record<string, string> }).__chosen);
    // The city is picked and seen as filled at once - no second, third... way tried.
    expect(chosen.city).toBe('Noida, Uttar Pradesh, India');
    expect(held.has(city.id)).toBe(true);
    expect(steps.join('\n')).not.toMatch(/Location \(City\)/);
    // The school is not in the list: nothing is picked rather than the first school shown.
    expect(chosen.school).toBeUndefined();
    expect(held.has(school.id)).toBe(false);
    const after = await runner.snapshot(page, null);
    expect(after.fields.find((f) => f.id === city.id)!.value).toBe('Noida, Uttar Pradesh, India');
    await page.close();
  });
});
