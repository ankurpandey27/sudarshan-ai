// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { JobPlatform } from '../../jobs/enums/job-platform.enum';
import { JobSource } from '../../jobs/enums/job-source.enum';
import { parseJobUrl } from '../../jobs/utils/job-url.util';
import { platformOf } from '../../jobs/utils/platform.util';
import { indeedCardToDiscovered, indeedFromage, indeedSearchUrl } from './indeed.util';

describe('Indeed search', () => {
  it('builds the search address Indeed uses: q, l, fromage, start', () => {
    const u = new URL(indeedSearchUrl('nodejs developer', 'Noida', 7, 0));
    expect(u.origin + u.pathname).toBe('https://in.indeed.com/jobs');
    expect(u.searchParams.get('q')).toBe('nodejs developer');
    expect(u.searchParams.get('l')).toBe('Noida');
    expect(u.searchParams.get('fromage')).toBe('7');
    expect(u.searchParams.has('start')).toBe(false);
    expect(new URL(indeedSearchUrl('nodejs developer', 'Remote', 7, 1)).searchParams.get('start')).toBe('10');
    expect(new URL(indeedSearchUrl('nodejs developer', 'work from home', 7, 1)).searchParams.get('l')).toBe('Remote');
  });

  it('rounds "posted within" up to a choice Indeed offers', () => {
    expect([1, 2, 5, 7, 10, 30].map(indeedFromage)).toEqual([1, 3, 7, 7, 14, 14]);
  });

  it('maps a result card, marking "Easily apply" jobs', () => {
    const job = indeedCardToDiscovered({
      jobkey: '556f9e899af87808',
      displayTitle: 'NodeJS Developer || Noida',
      company: 'Ebizon',
      formattedLocation: 'Noida, Uttar Pradesh',
      remoteLocation: false,
      snippet: '<ul><li>You will work closely with our <b>web developers</b></li></ul>',
      pubDate: 1790053200000,
      indeedApplyEnabled: true,
    })!;
    expect(job).toMatchObject({
      source: JobSource.INDEED,
      externalId: '556f9e899af87808',
      url: 'https://in.indeed.com/viewjob?jk=556f9e899af87808',
      company: 'Ebizon',
      easyApply: true,
      isRemote: false,
      description: 'You will work closely with our web developers',
    });
    expect(platformOf(job.source, job.url)).toBe(JobPlatform.INDEED);
    expect(indeedCardToDiscovered({ jobkey: 'a105aa7fec78ad13', expired: true })).toBeNull();
  });

  it('recognises pasted Indeed links, with the same id as a found job', () => {
    for (const link of [
      'https://in.indeed.com/viewjob?jk=556f9e899af87808',
      'https://in.indeed.com/jobs?q=node&l=Noida&vjk=556f9e899af87808',
      'https://in.indeed.com/rc/clk?jk=556f9e899af87808&bb=abc',
    ]) {
      expect(parseJobUrl(link)).toEqual({ source: JobSource.INDEED, externalId: '556f9e899af87808', url: 'https://in.indeed.com/viewjob?jk=556f9e899af87808' });
    }
  });
});
