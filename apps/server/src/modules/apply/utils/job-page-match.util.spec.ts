// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { AD_LANDING } from '../../form-engine/constants/form-runner.constants';
import { mentionsJob } from './job-page-match.util';

const job = { title: 'Software Development Engineer III - Users', company: 'HighLevel' };

describe('a page reached on the way to an application is about this job (Mesa School, 2026-10-05)', () => {
  it('a business school sign-up page reached through an ad is not', () => {
    const mesa = 'Mesa School of Business. PGP in Startup Leadership & Entrepreneurship. 12 Months Full-Time Bangalore. KNOW MORE. Name Email City Submit';
    expect(mentionsJob(mesa, 'https://mesaschool.co/?utm_source=google-ads', job)).toBe(false);
  });

  it('the employer\'s form is - by company name in the text, the address, or most of the title', () => {
    expect(mentionsJob('Apply for this job. First name, Last name, Resume', 'https://job-boards.greenhouse.io/gohighlevel/jobs/1', job)).toBe(true);
    expect(mentionsJob('High Level careers - Apply', 'https://careers.example.com/apply', job)).toBe(true);
    expect(mentionsJob('Careers at HighLevel. Apply now', 'https://jobs.lever.co/x/1', job)).toBe(true);
    expect(mentionsJob('Software Development Engineer III, Users team. Apply', 'https://apply.workable.com/x', job)).toBe(true);
    expect(mentionsJob('Capco - Thank you', 'https://job-boards.greenhouse.io/capco/jobs/1', { title: 'Desenvolvedor(a) Backend Pleno - (Node.js)', company: 'Capco' })).toBe(true);
  });

  it('a job with nothing to look for is never held back', () => {
    expect(mentionsJob('Apply', 'https://x.example', { title: 'Dev', company: 'Ltd' })).toBe(true);
  });
});

describe('an advertiser\'s page, by its address', () => {
  it.each([
    'https://mesaschool.co/?utm_source=google-ads&utm_medium=cpc&utm_campaign=x',
    'https://example.com/landing?gclid=abc123',
    'https://example.com/?gad_source=1&gbraid=x',
    'https://adclick.g.doubleclick.net/pcs/click?xai=1',
    'https://www.googleadservices.com/pagead/aclk?sa=L',
  ])('%s is one', (url) => expect(AD_LANDING.test(url)).toBe(true));

  it.each([
    'https://himalayas.app/companies/highlevel/jobs/sde-3?utm_source=himalayas.app',
    'https://jobs.smartrecruiters.com/oneclick-ui/company/Nagarro1/publication/1?utm_source=himalayas.app&utm_medium=himalayas.app',
    'https://www.linkedin.com/jobs/view/4474250204/',
  ])('%s is not', (url) => expect(AD_LANDING.test(url)).toBe(false));
});
