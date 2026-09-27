// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { StorageService } from '../../common/storage/storage.service';
import { FormAction } from './interfaces/form-field.interface';
import { PlaybookService } from './playbook.service';
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
});
