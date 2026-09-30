// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { join } from 'node:path';
import puppeteer, { Browser, Page } from 'puppeteer-core';
import { StorageService } from '../src/common/storage/storage.service';
import { AnswersService } from '../src/modules/answers/answers.service';
import { GENERIC_SUCCESS } from '../src/modules/apply/constants/apply.constants';
import { findBrowserExecutable } from '../src/modules/browser/utils/browser-executable.util';
import { AnswerEngineService } from '../src/modules/form-engine/answer-engine.service';
import { FormRunnerService } from '../src/modules/form-engine/form-runner.service';
import { PlaybookService } from '../src/modules/form-engine/playbook.service';
import { RecipesService } from '../src/modules/form-engine/recipes.service';
import { RescueService } from '../src/modules/form-engine/rescue.service';
import { LlmService } from '../src/modules/llm/llm.service';
import { EMPTY_PROFILE } from '../src/modules/profile/constants/profile.constants';

const FIXTURE = `file://${join(__dirname, 'fixtures', 'rescue-odd.html').replace(/\\/g, '/')}`;

/**
 * A stand-in AI that plans like a real one: it reads the numbered controls and presses what moves the
 * application on - and, as models sometimes do, also asks for "Withdraw application", which must be refused.
 */
const fakeAi = (opts: { tooLongFirst?: boolean } = {}) => {
  const prompts: string[] = [];
  let first = true;
  const idOf = (prompt: string, text: string) => new RegExp(`\\[(\\w+)\\] [^\\n]*"${text}`).exec(prompt)?.[1];
  const llm = {
    isAvailable: () => true,
    current: () => ({ provider: 'fake', model: 'planner' }),
    acceptsImages: () => false,
    json: async (prompt: string) => {
      if (prompt.includes('CONTROLS AND FIELDS')) {
        prompts.push(prompt);
        if (opts.tooLongFirst && first) {
          first = false;
          throw new Error("This model's maximum context length is 4096 tokens");
        }
        // Only the list of controls counts - "tried so far" mentions earlier pages too.
        const controls = prompt.split('CONTROLS AND FIELDS:')[1].split('TRIED SO FAR')[0];
        if (controls.includes('"Onwards"')) {
          return {
            actions: [
              { choose: idOf(prompt, 'How did you hear'), option: 'Job board' },
              { click: idOf(prompt, 'Withdraw application') },
              { click: idOf(prompt, 'Onwards') },
            ],
          };
        }
        if (controls.includes('"Finalise"')) return { actions: [{ click: idOf(prompt, 'Finalise'), submits: true }] };
        return { stuck: true };
      }
      // The usual one-button fallback and form answers: nothing useful, so the usual way gets stuck.
      if (prompt.includes('CLICKABLE CONTROLS')) return { id: '' };
      if (prompt.includes('Does this page confirm')) return { confirmed: false };
      return { answers: [] };
    },
  } as unknown as LlmService;
  return { llm, prompts };
};

describe('The rescue agent on a site ordinary automation cannot finish (real browser)', () => {
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
  beforeEach(async () => {
    page = await browser.newPage();
    await page.goto(FIXTURE);
  });
  afterEach(async () => {
    await page.close();
  });

  const setup = (ai: ReturnType<typeof fakeAi>) => {
    const storage = new StorageService(':memory:');
    const engine = new AnswerEngineService(new AnswersService(storage), ai.llm);
    const rescue = new RescueService(ai.llm, engine, storage);
    const runner = new FormRunnerService(engine, new RecipesService(storage), ai.llm, new PlaybookService(storage), undefined, rescue);
    const steps: string[] = [];
    const opts = {
      scopeSelector: null,
      successPattern: GENERIC_SUCCESS,
      ctx: {
        profile: { ...EMPTY_PROFILE, country: 'India' },
        job: { id: 1, title: 'Backend', company: 'Acme', location: 'Noida', description: '' },
        resumePath: null,
        skillYears: () => null,
      },
      domain: 'careers.odd.example',
      allowLlm: true,
      pauseBeforeSubmit: false,
      onStep: (m: string) => steps.push(m),
    };
    return { storage, runner, rescue, steps, opts };
  };

  it('gets it through: presses unfamiliar buttons, chooses an option, refuses the trap', async () => {
    const ai = fakeAi();
    const { storage, runner, steps, opts } = setup(ai);
    const out = await runner.run(page, opts);
    // On failure, show what happened and what the AI saw.
    if (out.status !== 'applied')
      throw new Error([...steps, '---', ...ai.prompts.map((p) => p.split('CONTROLS AND FIELDS:')[1]?.split('TRIED')[0])].join('\n'));
    expect(out).toMatchObject({ status: 'applied', detail: 'Application submitted (rescued)' });
    const seen = await page.evaluate(() => ({
      sent: (window as never as { __sent: unknown }).__sent,
      withdrawn: (window as never as { __withdrawn: boolean }).__withdrawn,
    }));
    expect(seen).toEqual({ sent: { source: 'Job board' }, withdrawn: false });
    // The consent box was ticked the usual way, before the rescue.
    expect(steps.some((s) => /^Rescue step \d \(AI\): .*skipped unsafe or unknown control/.test(s))).toBe(true);
    // Its steps are learned for this site once the application is confirmed.
    expect(out.moves?.filter((m) => m.by === 'ai').map((m) => m.text)).toEqual(['Onwards', 'Finalise']);
    expect(storage.all('SELECT outcome FROM rescue_runs')).toEqual([{ outcome: 'applied' }]);
    // Nothing that identifies the candidate is in what the AI saw.
    expect(ai.prompts.join('\n')).not.toMatch(/@|\d{10}/);
  });

  it('stops before sending when you asked it to, even at a button it has never seen', async () => {
    const ai = fakeAi();
    const { runner, opts } = setup(ai);
    const out = await runner.run(page, { ...opts, pauseBeforeSubmit: true });
    expect(out.status).toBe('ready_to_submit');
    expect(await page.evaluate(() => (window as never as { __sent: unknown }).__sent)).toBeNull();
  });

  it('asks again with a shorter page when the model says the prompt is too long', async () => {
    const ai = fakeAi({ tooLongFirst: true });
    const { runner, opts } = setup(ai);
    const out = await runner.run(page, opts);
    // It asked again after "too long" (a small page fits the shortest size already) and got through.
    expect(out.status).toBe('applied');
    expect(ai.prompts.length).toBeGreaterThanOrEqual(3);
    expect(ai.prompts[1].length).toBeLessThanOrEqual(ai.prompts[0].length);
  });

  it('pauses itself after failing again and again with a model - and can be tried again', () => {
    const ai = fakeAi();
    const { storage, rescue } = setup(ai);
    for (let i = 0; i < 5; i++) {
      storage.run("INSERT INTO rescue_runs (at, provider, model, domain, outcome, steps) VALUES ('x', 'fake', 'planner', 'd', 'failed', 3)");
    }
    expect(rescue.status()).toMatchObject({ paused: true, failedInARow: 5 });
    expect(rescue.available()).toBe(false);
    rescue.resume();
    expect(rescue.available()).toBe(true);
    // Another model starts fresh.
    (ai.llm as unknown as { current: () => unknown }).current = () => ({ provider: 'fake', model: 'bigger' });
    expect(rescue.status().tries).toBe(0);
  });
});
