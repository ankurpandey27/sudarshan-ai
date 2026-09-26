import { join } from 'node:path';
import puppeteer, { Browser, Page } from 'puppeteer-core';
import { StorageService } from '../src/common/storage/storage.service';
import { AnswersService } from '../src/modules/answers/answers.service';
import { AnswerSource } from '../src/modules/answers/enums/answer-source.enum';
import { AnswerEngineService } from '../src/modules/form-engine/answer-engine.service';
import { FormRunnerService } from '../src/modules/form-engine/form-runner.service';
import { RecipesService } from '../src/modules/form-engine/recipes.service';
import { AnswerContext } from '../src/modules/form-engine/interfaces/answer-context.interface';
import { findBrowserExecutable } from '../src/modules/browser/utils/browser-executable.util';
import { LlmService } from '../src/modules/llm/llm.service';
import { EMPTY_PROFILE } from '../src/modules/profile/constants/profile.constants';

const FIXTURE = `file://${join(__dirname, 'fixtures', 'easy-apply.html').replace(/\\/g, '/')}`;
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
    runner = new FormRunnerService(new AnswerEngineService(answers, noLlm), new RecipesService(storage), noLlm);
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
    answers.remember(
      'Why do you want to join Acme?',
      'I build Node.js and React systems and want to grow with a product team like Acme.',
      AnswerSource.USER,
    );
    const out = await run();
    expect(out).toMatchObject({ status: 'applied', llmCalls: 0 });
    const submitted = await page.evaluate(() => (window as unknown as { __submitted: Record<string, unknown> }).__submitted);
    expect(submitted).toEqual({
      fn: 'Priya',
      ph: '9876543210',
      cc: 'India (+91)',
      yr: '3', // 3.7 years -> whole years, never rounded up
      reloc: 'Yes',
      np: '1 month',
      ectc: '18',
      why: 'I build Node.js and React systems and want to grow with a product team like Acme.',
      cv: 'resume.pdf',
      follow: true, // marketing checkbox left alone
    });
    expect(out.memoryHits).toBe(1);
  });
});
