import { JobSource } from '../enums/job-source.enum';
import { parseJobUrl } from './job-url.util';

describe('parseJobUrl', () => {
  it('routes LinkedIn links (any form) to the LinkedIn adapter with a stable id', () => {
    expect(parseJobUrl('https://in.linkedin.com/jobs/view/senior-dev-at-acme-4472065469?trk=x')).toEqual({
      source: JobSource.LINKEDIN,
      externalId: '4472065469',
      url: 'https://www.linkedin.com/jobs/view/4472065469/',
    });
    expect(parseJobUrl('https://www.linkedin.com/jobs/search/?currentJobId=4470297204')?.externalId).toBe('4470297204');
  });

  it('routes Naukri links to the Naukri adapter', () => {
    const p = parseJobUrl('https://www.naukri.com/job-listings-backend-developer-acme-bengaluru-3-to-6-years-250926000123?src=x');
    expect(p).toMatchObject({ source: JobSource.NAUKRI, externalId: '250926000123' });
  });

  it('treats anything else as a generic career site, ignoring tracking params', () => {
    const a = parseJobUrl('boards.greenhouse.io/acme/jobs/123?gh_src=abc&utm_source=li');
    const b = parseJobUrl('https://boards.greenhouse.io/acme/jobs/123');
    expect(a?.source).toBe(JobSource.WEB);
    expect(a?.externalId).toBe(b?.externalId);
  });

  it('rejects non-URLs', () => {
    expect(parseJobUrl('not a link')).toBeNull();
  });
});
