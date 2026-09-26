import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'puppeteer-core';
import { sleep } from '../../../common/utils/sleep.util';
import { FormRunnerService } from '../../form-engine/form-runner.service';
import { RecipesService } from '../../form-engine/recipes.service';
import { FormAction, FormSnapshot } from '../../form-engine/interfaces/form-field.interface';
import { documentTextInPage } from '../../form-engine/scripts/page-helpers.script';
import { buildNavigatePrompt, NAVIGATE_SYSTEM_PROMPT } from '../../form-engine/utils/navigate-prompt.util';
import { JobSource } from '../../jobs/enums/job-source.enum';
import { Job } from '../../jobs/interfaces/job.interface';
import { LlmService } from '../../llm/llm.service';
import { LlmPurpose } from '../../llm/enums/llm-purpose.enum';
import { CLOSED_TEXT, GENERIC_SUCCESS, LOGIN_WALL } from '../constants/apply.constants';
import { PrepareStatus } from '../enums/prepare-status.enum';
import { ApplyAdapter, PrepareResult } from '../interfaces/apply-adapter.interface';
import { clickCatchingNewTab } from '../utils/new-tab.util';

const DIALOG = '[role=dialog], [aria-modal=true], .modal.show, .modal[open]';

@Injectable()
export class WebApplyAdapter implements ApplyAdapter {
  private readonly logger = new Logger(WebApplyAdapter.name);

  constructor(
    private readonly runner: FormRunnerService,
    private readonly recipes: RecipesService,
    private readonly llm: LlmService,
  ) {}

  matches(job: Job): boolean {
    return job.source === JobSource.WEB;
  }

  prepare(page: Page, job: Job): Promise<PrepareResult> {
    return this.prepareUrl(page, job.applyUrl || job.url);
  }

  // Also used when LinkedIn or Naukri hands off to a company site.
  async prepareUrl(page: Page, url: string): Promise<PrepareResult> {
    const result = (status: PrepareStatus, extra: Partial<PrepareResult> = {}): PrepareResult => ({
      status,
      scopeSelector: null,
      successPattern: GENERIC_SUCCESS,
      ...extra,
    });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await this.runner.settle(page);
    let current = page;
    const domain = new URL(current.url()).hostname.replace(/^www\./, '');

    for (let hop = 0; hop < 3; hop++) {
      const snap = await this.runner.snapshot(current, null);
      const text = await current.evaluate(documentTextInPage);
      if (CLOSED_TEXT.test(text)) return result(PrepareStatus.CLOSED);
      if (GENERIC_SUCCESS.test(text) && /already/i.test(text)) return result(PrepareStatus.ALREADY_APPLIED);
      if (snap.captcha) return result(PrepareStatus.CAPTCHA, { page: current });
      if (this.looksLikeLogin(snap, text)) return result(PrepareStatus.LOGIN_REQUIRED, { detail: `Log in to ${domain} in the agent browser`, page: current });
      if (this.hasApplicationForm(snap)) {
        const dialog = await current.$(DIALOG);
        return result(PrepareStatus.READY, { scopeSelector: dialog ? DIALOG : null, page: current });
      }

      const action = await this.findApplyAction(snap, domain, text);
      if (!action) return result(PrepareStatus.NO_APPLY_BUTTON, { page: current });
      const tab = await clickCatchingNewTab(current, () => this.runner.click(current, action.id));
      if (tab) current = tab;
      await this.runner.settle(current);
      await sleep(500);
    }
    return result(PrepareStatus.NO_APPLY_BUTTON, { detail: 'Could not reach the application form', page: current });
  }

  private hasApplicationForm(snap: FormSnapshot): boolean {
    const labels = snap.fields.map((f) => `${f.label} ${f.name} ${f.kind}`.toLowerCase());
    const signals = [/name/, /e-?mail/, /phone|mobile/, /resume|cv|file/].filter((re) => labels.some((l) => re.test(l))).length;
    return snap.fields.length >= 2 && signals >= 2;
  }

  private looksLikeLogin(snap: FormSnapshot, text: string): boolean {
    const onlyAuth = snap.fields.length > 0 && snap.fields.length <= 3 && snap.fields.every((f) => /e-?mail|user|login|password/i.test(`${f.label} ${f.name}`));
    return LOGIN_WALL.test(text) || (onlyAuth && /sign in|log in|login/i.test(text));
  }

  private async findApplyAction(snap: FormSnapshot, domain: string, text: string): Promise<FormAction | null> {
    const usable = snap.actions.filter((a) => !a.disabled);
    const recipe = this.recipes.get(domain);
    const learned = usable.find((a) => recipe.applyTexts.includes(a.text.toLowerCase()));
    if (learned) return learned;
    const obvious = usable.find((a) => a.kind === 'apply');
    if (obvious) return obvious;
    if (!this.llm.isAvailable() || usable.length === 0) return null;
    try {
      const pick = await this.llm.json<{ id?: string; applicationDone?: boolean }>(
        buildNavigatePrompt('Open the job application form', text, usable),
        { purpose: LlmPurpose.NAVIGATE, system: NAVIGATE_SYSTEM_PROMPT, maxTokens: 150 },
      );
      const action = usable.find((a) => a.id === pick.id) ?? null;
      if (action) this.recipes.learn(domain, 'apply', action.text);
      return action;
    } catch (err) {
      this.logger.warn(`Navigator failed on ${domain}: ${(err as Error).message}`);
      return null;
    }
  }
}
