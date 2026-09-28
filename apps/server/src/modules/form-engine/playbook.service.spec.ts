// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { StorageService } from '../../common/storage/storage.service';
import { FormAction } from './interfaces/form-field.interface';
import { PlaybookService } from './playbook.service';
import { RecipesService } from './recipes.service';
import { stepSignature } from './utils/step-signature.util';

const act = (text: string, kind: FormAction['kind'] = 'next'): FormAction => ({ id: text, text, kind, disabled: false }) as FormAction;

describe('step playbooks', () => {
  it('sees the same kind of step on different jobs as one step', () => {
    const a = stepSignature({
      url: 'https://smartapply.indeed.com/beta/indeedapply/form/resume?jk=556f9e899af87808',
      actions: [act('Continue'), act('Close', 'dismiss')],
    });
    const b = stepSignature({ url: 'https://smartapply.indeed.com/beta/indeedapply/form/resume?jk=9ca840eb60077eeb', actions: [act('Continue')] });
    const c = stepSignature({ url: 'https://smartapply.indeed.com/beta/indeedapply/form/review', actions: [act('Submit your application', 'submit')] });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(stepSignature({ url: 'https://acme.keka.com/careers/jobdetails/160652/apply', actions: [act('Next')] })).toBe(
      stepSignature({ url: 'https://acme.keka.com/careers/jobdetails/171234/apply', actions: [act('Next')] }),
    );
  });

  it('prefers buttons that moved the step forward, and drops ones that stopped working', () => {
    const playbook = new PlaybookService(new StorageService(':memory:'));
    playbook.record('site.com', 'step', 'Continue', true);
    playbook.record('site.com', 'step', 'Save & Next', true);
    playbook.record('site.com', 'step', 'Save & Next', true);
    expect(playbook.preferred('site.com', 'step')).toEqual(['save & next', 'continue']);

    // The site changed: "Continue" now does nothing.
    playbook.record('site.com', 'step', 'Continue', false);
    playbook.record('site.com', 'step', 'Continue', false);
    expect(playbook.preferred('site.com', 'step')).toEqual(['save & next']);
    expect(playbook.preferred('other.com', 'step')).toEqual([]);
  });

  it('never learns or prefers a button that leaves the application (Indeed, 2026-09-28)', () => {
    const storage = new StorageService(':memory:');
    const playbook = new PlaybookService(storage);
    const recipes = new RecipesService(storage);
    const domain = 'smartapply.indeed.com';
    // What finishing forms by hand had taught it: notifications, Save and close, the captcha.
    for (const junk of ['1 new update', 'save and close', 'preview what the employer sees', 'verify', 'save']) {
      playbook.record(domain, 'review', junk, true);
      recipes.learn(domain, 'advance', junk);
    }
    playbook.record(domain, 'review', 'submit your application', true);
    recipes.learn(domain, 'advance', 'submit your application');
    recipes.learn(domain, 'apply', 'search jobs here');
    recipes.learn(domain, 'apply', 'apply now');
    expect(playbook.preferred(domain, 'review')).toEqual(['submit your application']);
    expect(recipes.get(domain).advanceTexts).toEqual(['submit your application']);
    expect(recipes.get(domain).applyTexts).toEqual(['apply now']);

    // Entries saved before this rule are ignored when read back.
    storage.run('UPDATE recipes SET data = ? WHERE domain = ?', [
      JSON.stringify({ applyTexts: ['junior frontend developer'], advanceTexts: ['1 new update', 'continue'] }),
      domain,
    ]);
    storage.run("INSERT INTO playbook_steps (domain, signature, action, ok, fail, updated_at) VALUES (?, 'review', 'save and close', 5, 0, '')", [domain]);
    expect(recipes.get(domain).advanceTexts).toEqual(['continue']);
    expect(recipes.get(domain).applyTexts).toEqual([]);
    expect(playbook.preferred(domain, 'review')).toEqual(['submit your application']);
  });
});
