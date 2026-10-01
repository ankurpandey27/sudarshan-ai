// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { join } from 'node:path';
import puppeteer, { Browser, Page } from 'puppeteer-core';
import { StorageService } from '../src/common/storage/storage.service';
import { AnswersService } from '../src/modules/answers/answers.service';
import { AnswerSource } from '../src/modules/answers/enums/answer-source.enum';
import { AnswerEngineService } from '../src/modules/form-engine/answer-engine.service';
import { FormRunnerService } from '../src/modules/form-engine/form-runner.service';
import { PlaybookService } from '../src/modules/form-engine/playbook.service';
import { RecipesService } from '../src/modules/form-engine/recipes.service';
import { AnswerContext } from '../src/modules/form-engine/interfaces/answer-context.interface';
import { findBrowserExecutable } from '../src/modules/browser/utils/browser-executable.util';
import { LlmService } from '../src/modules/llm/llm.service';
import { EMPTY_PROFILE } from '../src/modules/profile/constants/profile.constants';
import { GENERIC_SUCCESS, INDEED_SUCCESS, LINKEDIN_SCOPE, NAUKRI_DRAWER, NAUKRI_SUCCESS } from '../src/modules/apply/constants/apply.constants';
import { stepSignature } from '../src/modules/form-engine/utils/step-signature.util';
import { NaukriApplyAdapter } from '../src/modules/apply/adapters/naukri.adapter';
import { WebApplyAdapter } from '../src/modules/apply/adapters/web.adapter';
import { PrepareStatus } from '../src/modules/apply/enums/prepare-status.enum';

const FIXTURE = `file://${join(__dirname, 'fixtures', 'easy-apply.html').replace(/\\/g, '/')}`;
const FIXTURE_2026 = `file://${join(__dirname, 'fixtures', 'easy-apply-2026.html').replace(/\\/g, '/')}`;
const RESUME = join(__dirname, 'fixtures', 'resume.pdf');
const SUCCESS = /application was sent/i;
const SCOPE = '.jobs-easy-apply-modal, [role=dialog]';

const noLlm = { isConfigured: () => false, isAvailable: () => false } as unknown as LlmService;

const ctx: AnswerContext = {
  profile: {
    ...EMPTY_PROFILE,
    firstName: 'Priya',
    lastName: 'Sharma',
    email: 'priya@example.com',
    phone: '9876543210',
    phoneCountryCode: '+91',
    city: 'Bengaluru',
    totalYearsExperience: 4.5,
    noticePeriodDays: 30,
    expectedCtc: 1_800_000,
    willingToRelocate: true,
    skills: [
      { name: 'React', years: 3.7 },
      { name: 'Node.js', years: null },
    ],
  },
  job: { id: 1, title: 'Senior Backend Engineer', company: 'Acme', location: 'Bengaluru', description: 'Node.js, React' },
  resumePath: RESUME,
  skillYears: (skill) => {
    const s = ctx.profile.skills.find((x) => x.name.toLowerCase().replace(/\.js$/, '') === skill.toLowerCase().replace(/\.js$/, ''));
    return s ? (s.years ?? ctx.profile.totalYearsExperience) : null;
  },
};

describe('FormRunner on a LinkedIn-style Easy Apply dialog (real browser)', () => {
  let browser: Browser;
  let page: Page;
  let storage: StorageService;
  let answers: AnswersService;
  let runner: FormRunnerService;

  beforeAll(async () => {
    const executablePath = findBrowserExecutable();
    if (!executablePath) throw new Error('Chrome/Edge not found - browser tests need one installed');
    browser = await puppeteer.launch({ executablePath, headless: true, args: ['--allow-file-access-from-files'] });
  });

  afterAll(async () => {
    await browser?.close();
  });

  beforeEach(async () => {
    storage = new StorageService(':memory:');
    answers = new AnswersService(storage);
    runner = new FormRunnerService(new AnswerEngineService(answers, noLlm), new RecipesService(storage), noLlm, new PlaybookService(storage));
    page = await browser.newPage();
    await page.goto(FIXTURE);
    await page.click('#easy');
  });

  afterEach(async () => {
    await page.close();
  });

  const run = () =>
    runner.run(page, {
      scopeSelector: SCOPE,
      successPattern: SUCCESS,
      ctx,
      domain: 'fixture.local',
      allowLlm: false,
      pauseBeforeSubmit: false,
      onStep: () => undefined,
    });

  it('fills two steps from the profile alone, then asks the user the free-text question', async () => {
    const out = await run();
    expect(out.status).toBe('needs_input');
    expect(out.unresolved.map((u) => u.field.label)).toEqual(['Why do you want to join Acme?']);
    expect(out.llmCalls).toBe(0);
    expect(out.profileHits).toBeGreaterThanOrEqual(8);
  });

  it('submits end to end once the answer is in memory, with correct values', async () => {
    answers.remember('Why do you want to join Acme?', 'I build Node.js and React systems and want to grow with a product team like Acme.', AnswerSource.USER);
    const out = await run();
    expect(out).toMatchObject({ status: 'applied', llmCalls: 0 });
    const submitted = await page.evaluate(() => (window as unknown as { __submitted: Record<string, unknown> }).__submitted);
    expect(submitted).toEqual({
      fn: 'Priya',
      ph: '9876543210',
      cc: 'India (+91)',
      yr: '4', // 3.7 years -> the nearest whole year (4.9 -> 5, 4.4 -> 4)
      reloc: 'Yes',
      np: '1 month',
      ectc: '18',
      why: 'I build Node.js and React systems and want to grow with a product team like Acme.',
      cv: 'resume.pdf',
      follow: true, // marketing checkbox left alone
    });
    expect(out.memoryHits).toBe(1);
  });

  it('tries another button when one does nothing, and goes straight to it next time', async () => {
    const url = `file://${join(__dirname, 'fixtures', 'dead-continue.html').replace(/\\/g, '/')}`;
    const runOnce = async () => {
      const steps: string[] = [];
      await page.goto(url);
      const out = await runner.run(page, {
        scopeSelector: null,
        successPattern: /application has been submitted/i,
        ctx,
        domain: 'changed.example',
        allowLlm: false,
        pauseBeforeSubmit: false,
        onStep: (m) => steps.push(m),
      });
      return { out, steps };
    };

    const first = await runOnce();
    expect(first.out.status).toBe('applied');
    expect(first.steps.some((m) => /"Continue" did nothing - trying another way/.test(m))).toBe(true);
    // The application was confirmed, so its moves are learned (as the apply service does).
    new PlaybookService(storage).confirm(first.out.moves ?? []);

    // Learned: this kind of step moves on with "Save & Next".
    const second = await runOnce();
    expect(second.out.status).toBe('applied');
    expect(second.steps.some((m) => /did nothing/.test(m))).toBe(false);
    expect(second.steps.some((m) => /"Save & Next"/.test(m))).toBe(true);
  });

  it('answers the Naukri chat from your saved answers and profile, never with the resume, and waits for it to close', async () => {
    // Your answer from the Questions page, as in the screenshots.
    answers.remember('Are you available for a interview?(Virtual)', 'Yes', AnswerSource.USER);
    answers.remember('Are you currently serving Notice Period? If yes, when is your LWD?', 'Yes, 16-Oct-2026', AnswerSource.USER);
    const naukri = new NaukriApplyAdapter({} as never, runner, new AnswerEngineService(answers, noLlm));
    await page.goto(`file://${join(__dirname, 'fixtures', 'naukri-chat.html').replace(/\\/g, '/')}`);
    const steps: string[] = [];
    const out = await naukri.runForm(
      page,
      { status: PrepareStatus.READY, scopeSelector: NAUKRI_DRAWER, successPattern: NAUKRI_SUCCESS, page },
      {
        scopeSelector: NAUKRI_DRAWER,
        successPattern: NAUKRI_SUCCESS,
        ctx: { ...ctx, resumePath: join(__dirname, 'fixtures', 'resume.pdf') },
        domain: 'naukri.com',
        allowLlm: false,
        pauseBeforeSubmit: false,
        onStep: (m) => steps.push(m),
      },
    );
    const seen = await page.evaluate(() => ({
      uploads: (window as unknown as { __uploads: number }).__uploads,
      answers: (window as unknown as { __answers: string[] }).__answers,
    }));
    expect(seen.uploads).toBe(0);
    // Your saved answers, and the notice length only where it is asked - never "30 days" for an LWD question.
    expect(seen.answers).toEqual(['Yes', 'Yes, 16-Oct-2026', '30']);
    expect(out.status).toBe('applied');
    // Every step names a real question - never the empty "typing" bubble.
    expect(steps.every((m) => !/Naukri: ""/.test(m))).toBe(true);
    // Every answer sent is in the flight log, with where it came from.
    expect(steps).toContain('Naukri: "Are you currently serving Notice Period? If yes, when is your LWD?" -> "Yes, 16-Oct-2026" (your saved answer)');
  });

  it('knows Apply, Next, Send and Cancel in the major languages of the world', async () => {
    await page.goto(`file://${join(__dirname, 'fixtures', 'world-buttons.html').replace(/\\/g, '/')}`);
    const kinds = Object.fromEntries((await runner.snapshot(page, null)).actions.map((a) => [a.text, a.kind]));
    for (const t of [
      'Solliciteer nu',
      'Jetzt bewerben',
      'Postuler',
      'Postúlate',
      'Candidati ora',
      'Откликнуться',
      'Başvur',
      'Lamar sekarang',
      'Ứng tuyển ngay',
      'قدم الآن',
      'अभी आवेदन करें',
      '立即申请',
      '今すぐ応募',
      '지원하기',
    ]) {
      expect([t, kinds[t]]).toEqual([t, 'apply']);
    }
    for (const t of ['Weiter', 'Siguiente', '下一步', 'Далее']) expect([t, kinds[t]]).toEqual([t, 'next']);
    for (const t of ['Absenden', 'Enviar solicitud', '送信する', '제출']) expect([t, kinds[t]]).toEqual([t, 'submit']);
    for (const t of ['Annuleren', 'キャンセル']) expect([t, kinds[t]]).toEqual([t, 'dismiss']);
    // Whole words only.
    expect(kinds['Postulates of physics']).toBe('other');
    expect(kinds['Weiterbildung']).toBe('other');
  });

  it('applies on a Dutch career page: "Solliciteren", a Dutch form, "Versturen", "Bedankt voor je sollicitatie" (Aethon, 2026-09-29)', async () => {
    await page.goto(`file://${join(__dirname, 'fixtures', 'dutch-careers.html').replace(/\\/g, '/')}`);
    // The menu link is an Apply in Dutch.
    const first = await runner.snapshot(page, null);
    expect(first.actions.find((a) => a.text === 'Solliciteren')?.kind).toBe('apply');
    await runner.click(page, first.actions.find((a) => a.text === 'Solliciteren')!.id);
    answers.remember('Motivatie', 'Ik heb vijf jaar ervaring met Node.js en NestJS.', AnswerSource.USER);
    const out = await runner.run(page, {
      scopeSelector: null,
      successPattern: GENERIC_SUCCESS,
      ctx,
      domain: 'fixture.local',
      allowLlm: false,
      pauseBeforeSubmit: false,
      onStep: () => undefined,
    });
    const sent = await page.evaluate(() => (window as unknown as { __sent: Record<string, string> | null }).__sent);
    if (!sent) throw new Error(JSON.stringify({ status: out.status, detail: out.detail, unresolved: out.unresolved.map((u) => u.field.label) }));
    expect(sent).toMatchObject({ voornaam: 'Priya', achternaam: 'Sharma', email: 'priya@example.com', motivatie: expect.stringContaining('Node.js') });
    expect(sent?.telefoon).toContain('9876543210');
    // The Dutch "thank you for your application" counts, with no AI.
    expect(out).toMatchObject({ status: 'applied', detail: 'Application submitted', llmCalls: 0 });
  });

  it('fills and sends a WordPress contact-form application with a Send button, and sees it was sent (Betasoft, 2026-09-29)', async () => {
    await page.goto(`file://${join(__dirname, 'fixtures', 'contact-form7-apply.html').replace(/\\/g, '/')}`);
    answers.remember('Your message', 'I have 5 years of Node.js and NestJS and would like to apply for this role.', AnswerSource.USER);
    const out = await runner.run(page, {
      scopeSelector: null,
      successPattern: GENERIC_SUCCESS,
      ctx: { ...ctx, profile: { ...ctx.profile, linkedinUrl: 'https://www.linkedin.com/in/priya-sharma' } },
      domain: 'fixture.local',
      allowLlm: false,
      pauseBeforeSubmit: false,
      onStep: () => undefined,
    });
    const sent = await page.evaluate(() => (window as unknown as { __sent: Record<string, string> | null }).__sent);
    expect(sent).toMatchObject({
      'user-name': 'Priya Sharma',
      'your-email': 'priya@example.com',
      phone: expect.stringContaining('9876543210'),
      linkedin_url: 'https://www.linkedin.com/in/priya-sharma',
      'your-message': expect.stringContaining('Node.js'),
    });
    // The form is still on the page (emptied, marked sent) - it counts as sent all the same.
    expect(out).toMatchObject({ status: 'applied', detail: 'Application submitted' });
    // The resume was attached too, although the site does not require it.
    expect(out.steps).toBeGreaterThanOrEqual(2);
  });

  it('waits for a slow Indeed review page, presses Submit itself (no tick box) and sees "was submitted" (Indeed, 2026-09-29)', async () => {
    await page.goto(`file://${join(__dirname, 'fixtures', 'indeed-review-slow.html').replace(/\\/g, '/')}`);
    const out = await runner.run(page, {
      scopeSelector: null,
      successPattern: INDEED_SUCCESS,
      ctx,
      domain: 'fixture.local',
      allowLlm: false,
      pauseBeforeSubmit: false,
      onStep: () => undefined,
    });
    expect(await page.evaluate(() => (window as unknown as { __submitted: number }).__submitted)).toBe(1);
    expect(out).toMatchObject({ status: 'applied', detail: 'Application submitted' });
  });

  it('presses Submit on an Indeed review page without a captcha, ignoring bad learned buttons (Indeed, 2026-09-28)', async () => {
    const url = `file://${join(__dirname, 'fixtures', 'indeed-review.html').replace(/\\/g, '/')}`;
    await page.goto(url);
    // What had been learned on this site before the fix, straight into storage.
    const signature = stepSignature(await runner.snapshot(page, null));
    for (const junk of ['1 new update', 'save and close', 'preview what the employer sees']) {
      storage.run("INSERT INTO playbook_steps (domain, signature, action, ok, fail, updated_at) VALUES ('fixture.local', ?, ?, 5, 0, '')", [signature, junk]);
    }
    storage.run("INSERT INTO recipes (domain, data, successes, failures, updated_at) VALUES ('fixture.local', ?, 0, 0, '')", [
      JSON.stringify({ applyTexts: [], advanceTexts: ['1 new update', 'save and close', 'preview what the employer sees'] }),
    ]);
    const out = await runner.run(page, {
      scopeSelector: null,
      successPattern: INDEED_SUCCESS,
      ctx,
      domain: 'fixture.local',
      allowLlm: false,
      pauseBeforeSubmit: false,
      onStep: () => undefined,
    });
    const seen = await page.evaluate(() => ({
      left: (window as unknown as { __left: number }).__left,
      submitted: (window as unknown as { __submitted: number }).__submitted,
    }));
    expect(seen).toEqual({ left: 0, submitted: 1 });
    expect(out.status).toBe('applied');
  });

  it('hands its moves back instead of learning them as it goes', async () => {
    await page.goto(`file://${join(__dirname, 'fixtures', 'indeed-review.html').replace(/\\/g, '/')}`);
    const out = await runner.run(page, {
      scopeSelector: null,
      successPattern: INDEED_SUCCESS,
      ctx,
      domain: 'moves.fixture',
      allowLlm: false,
      pauseBeforeSubmit: false,
      onStep: () => undefined,
    });
    expect(out.status).toBe('applied');
    expect(out.moves?.map((m) => m.text)).toEqual(['Submit your application']);
    // Nothing saved yet: whoever sees the ending (the apply service, or you finishing) decides.
    expect(storage.all("SELECT * FROM playbook_steps WHERE domain = 'moves.fixture'")).toEqual([]);
  });

  it('uploads the resume when the page only mentions ".pdf" in a hint', async () => {
    await page.goto(`file://${join(__dirname, 'fixtures', 'resume-hint.html').replace(/\\/g, '/')}`);
    const out = await runner.run(page, {
      scopeSelector: null,
      successPattern: GENERIC_SUCCESS,
      ctx: { ...ctx, resumePath: join(__dirname, 'fixtures', 'resume.pdf') },
      domain: 'fixture.local',
      allowLlm: false,
      pauseBeforeSubmit: false,
      onStep: () => undefined,
    });
    expect(await page.evaluate(() => (window as unknown as { __uploads: number }).__uploads)).toBe(1);
    expect(out.status).toBe('applied');
  });

  it('picks the site\'s own "I don\'t wish to answer" in dropdowns that show options only when opened (Sony, Greenhouse, 2026-10-01)', async () => {
    await page.goto(`file://${join(__dirname, 'fixtures', 'combobox-eeo.html').replace(/\\/g, '/')}`);
    const out = await runner.run(page, {
      scopeSelector: null,
      successPattern: GENERIC_SUCCESS,
      ctx,
      domain: 'fixture.local',
      allowLlm: false,
      pauseBeforeSubmit: false,
      onStep: () => undefined,
    });
    const chosen = await page.evaluate(() => (window as unknown as { __chosen: Record<string, string> }).__chosen).catch(() => null);
    expect(out.status).toBe('applied');
    // The page is replaced on success; what was chosen was recorded before.
    expect(chosen === null || Object.values(chosen).every((v) => v === "I don't wish to answer")).toBe(true);
  });

  it("never loops: Submit back on the same form twice -> it asks you, with the dropdown's real options", async () => {
    await page.goto(`file://${join(__dirname, 'fixtures', 'combobox-eeo.html').replace(/\\/g, '/')}`);
    // Nothing answers these here: no rule, no memory, no AI.
    await page.evaluate(() => {
      const w = window as unknown as { __opts: unknown };
      w.__opts = null;
    });
    const out = await runner.run(page, {
      scopeSelector: null,
      successPattern: GENERIC_SUCCESS,
      ctx: { ...ctx, profile: { ...ctx.profile, gender: '' } },
      domain: 'fixture.local',
      allowLlm: false,
      pauseBeforeSubmit: false,
      onStep: () => undefined,
      maxSteps: 15,
    });
    const submits = await page.evaluate(() => (window as unknown as { __submits: number }).__submits).catch(() => 0);
    expect(submits).toBeLessThanOrEqual(2);
    if (out.status !== 'applied') {
      expect(out.status).toBe('needs_input');
      expect(out.unresolved[0].field.options).toContain("I don't wish to answer");
    }
  });

  it('counts a thank-you shown right after Submit, even with the job form still behind it - never applies twice (DataOrb, 2026-09-30)', async () => {
    await page.goto(`file://${join(__dirname, 'fixtures', 'thanks-over-form.html').replace(/\\/g, '/')}`);
    const out = await runner.run(page, {
      scopeSelector: null,
      successPattern: GENERIC_SUCCESS,
      ctx,
      domain: 'fixture.local',
      allowLlm: false,
      pauseBeforeSubmit: false,
      onStep: () => undefined,
    });
    expect(out.status).toBe('applied');
    expect(await page.evaluate(() => (window as unknown as { __sent: number; __again: number }).__sent)).toBe(1);
    expect(await page.evaluate(() => (window as unknown as { __sent: number; __again: number }).__again)).toBe(0);
  });

  it('never calls an unsent Indeed review page "applied" - keeps the resume, hands over the captcha (Indeed)', async () => {
    // Offline: the captcha frame must not really load.
    await page.setRequestInterception(true);
    const block = (r: import('puppeteer-core').HTTPRequest) => (r.url().startsWith('file:') ? r.continue() : r.abort());
    page.on('request', block);
    const base = `file://${join(__dirname, 'fixtures', 'resume-step-captcha.html').replace(/\\/g, '/')}`;
    // Through the resume step, and straight onto a saved draft's review step.
    for (const url of [base, `${base}#review`]) {
      await page.goto('about:blank');
      await page.goto(url);
      const out = await runner.run(page, {
        scopeSelector: null,
        // The broad wording: the review page's "You've applied to 3 jobs" must still not count.
        successPattern: GENERIC_SUCCESS,
        ctx,
        domain: 'fixture.local',
        allowLlm: false,
        pauseBeforeSubmit: false,
        onStep: () => undefined,
      });
      expect(await page.evaluate(() => (window as unknown as { __uploads: number }).__uploads)).toBe(0);
      expect(out.status).toBe('captcha');
      expect(out.detail).toMatch(/captcha/i);
    }
    page.off('request', block);
    await page.setRequestInterception(false);
  });

  it('recognises a one-click apply (Instahyre) instead of reporting "no apply button"', async () => {
    const web = new WebApplyAdapter(runner, new RecipesService(storage), noLlm);
    const url = `file://${join(__dirname, 'fixtures', 'one-click-apply.html').replace(/\\/g, '/')}`;
    const fresh = await web.prepareUrl(page, url);
    expect(fresh.status).toBe(PrepareStatus.APPLIED);
    expect(await page.evaluate(() => (window as unknown as { __applied?: number }).__applied)).toBe(1);

    const again = await web.prepareUrl(page, `${url}#applied`);
    expect(again.status).toBe(PrepareStatus.ALREADY_APPLIED);
  });

  it('waits for a Workday page, goes through Apply Manually, and hands over its account page (Motorola, 2026-09-28)', async () => {
    const web = new WebApplyAdapter(runner, new RecipesService(storage), noLlm);
    const prep = await web.prepareUrl(page, `file://${join(__dirname, 'fixtures', 'workday-account.html').replace(/\\/g, '/')}`);
    // Previously: "no apply button" (looked too early), then "Could not reach the application form".
    expect(prep.status).toBe(PrepareStatus.LOGIN_REQUIRED);
    expect(prep.detail).toMatch(/needs an account/);
    // Nothing typed into the account form: no email, and never a password.
    expect(
      await page.evaluate(() => [...document.querySelectorAll('input[type=email], input[type=password]')].map((i) => (i as HTMLInputElement).value).join('')),
    ).toBe('');
  });

  it('opens the application pop-up before handing over its captcha (Hashcash, 2026-09-28)', async () => {
    const web = new WebApplyAdapter(runner, new RecipesService(storage), noLlm);
    const prep = await web.prepareUrl(page, `file://${join(__dirname, 'fixtures', 'apply-modal-captcha.html').replace(/\\/g, '/')}`);
    // Previously: "Captcha" straight away, with the form never opened or filled.
    expect(prep.status).toBe(PrepareStatus.READY);
    expect(await page.evaluate(() => document.getElementById('modal')!.classList.contains('open'))).toBe(true);
  });

  it('fills a career-site form around a text captcha and leaves the captcha to the person', async () => {
    await page.setContent(`<form>
      <label for="fn">First Name *</label><input id="fn" required>
      <label for="em">Email *</label><input id="em" type="email" required>
      <img alt="captcha" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="><input id="cap" placeholder="Captcha" required>
      <button type="submit">Apply Now</button>
    </form>`);
    const out = await runner.run(page, {
      scopeSelector: null,
      successPattern: SUCCESS,
      ctx,
      domain: 'fixture.local',
      allowLlm: false,
      pauseBeforeSubmit: true,
      onStep: () => undefined,
    });
    expect(out.status).toBe('ready_to_submit');
    expect(out.detail).toMatch(/captcha/i);
    expect(out.unresolved).toEqual([]);
    expect(await page.$eval('#fn', (e) => (e as HTMLInputElement).value)).toBe('Priya');
    expect(await page.$eval('#cap', (e) => (e as HTMLInputElement).value)).toBe('');
  });

  it("handles LinkedIn's 2026 dialog: native <dialog>, hidden 0x0 radios, question outside the group", async () => {
    await page.goto(FIXTURE_2026);
    await page.click('#easy');
    answers.remember("Are you comfortable commuting to this job's location?", 'Yes', AnswerSource.USER);
    const out = await runner.run(page, {
      scopeSelector: LINKEDIN_SCOPE,
      successPattern: SUCCESS,
      ctx,
      domain: 'fixture.local',
      allowLlm: false,
      pauseBeforeSubmit: false,
      onStep: () => undefined,
    });
    expect(out.status).toBe('applied');
    const submitted = await page.evaluate(() => (window as unknown as { __submitted: Record<string, unknown> }).__submitted);
    expect(submitted).toEqual({ phone: '9876543210', commute: 'Yes', react: '4' }); // 3.7 years, rounded
  });
});
