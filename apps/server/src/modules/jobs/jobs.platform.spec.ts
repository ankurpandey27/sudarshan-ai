// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { EventsService } from '../../common/events/events.service';
import { StorageService } from '../../common/storage/storage.service';
import { JobPlatform } from './enums/job-platform.enum';
import { JobSource } from './enums/job-source.enum';
import { JobStatus } from './enums/job-status.enum';
import { DiscoveredJob } from './interfaces/discovered-job.interface';
import { JobsService } from './jobs.service';
import { platformOf } from './utils/platform.util';

const posting = (source: JobSource, externalId: string, url: string, score: number): DiscoveredJob & { score: number } => ({
  source,
  externalId,
  url,
  title: `Backend ${externalId}`,
  company: 'Acme',
  location: 'Pune',
  isRemote: false,
  easyApply: true,
  description: '',
  score,
});

describe('job platforms', () => {
  const make = () => {
    const jobs = new JobsService(new StorageService(':memory:'), new EventsService());
    // Best score first, so without a platform filter LinkedIn would be picked.
    const all = [
      posting(JobSource.LINKEDIN, 'li', 'https://www.linkedin.com/jobs/view/1/', 90),
      posting(JobSource.NAUKRI, 'nk', 'https://www.naukri.com/job-listings-x-123456789', 80),
      posting(JobSource.WEB, 'ih', 'https://www.instahyre.com/job-12345-backend-engineer/', 70),
      posting(JobSource.WEB, 'lv', 'https://jobs.lever.co/acme/abc', 60),
    ];
    for (const p of all) {
      const [id] = jobs.saveDiscovered([p]);
      jobs.setScore(id, p.score, { technical: 0, salary: 0, location: 0, engine: p.score, llm: null, matchedSkills: [], missingSkills: [], summary: '' }, JobStatus.APPROVED, 'ok');
    }
    return jobs;
  };

  it('labels every job with its platform', () => {
    expect(platformOf(JobSource.WEB, 'https://www.instahyre.com/job-1/')).toBe(JobPlatform.INSTAHYRE);
    expect(platformOf(JobSource.WEB, 'https://jobs.lever.co/acme/1')).toBe(JobPlatform.OTHER);
    expect(platformOf(JobSource.WEB, 'https://careers.acme.com/1', 'https://instahyre.com/apply/1')).toBe(JobPlatform.INSTAHYRE);
    expect(make().list({}).items.map((j) => j.platform).sort()).toEqual(['instahyre', 'linkedin', 'naukri', 'other']);
  });

  it('applies only on the platforms that are switched on', () => {
    const jobs = make();
    expect(jobs.nextToApply([JobPlatform.NAUKRI])?.platform).toBe(JobPlatform.NAUKRI);
    expect(jobs.nextToApply([JobPlatform.INSTAHYRE])?.platform).toBe(JobPlatform.INSTAHYRE);
    expect(jobs.nextToApply([JobPlatform.NAUKRI, JobPlatform.INSTAHYRE])?.platform).toBe(JobPlatform.NAUKRI);
    expect(jobs.nextToApply([JobPlatform.LINKEDIN, JobPlatform.NAUKRI, JobPlatform.INSTAHYRE, JobPlatform.OTHER])?.platform).toBe(JobPlatform.LINKEDIN);
    expect(jobs.nextToApply([])).toBeNull();
  });

  it('counts jobs per platform and filters by platform', () => {
    const jobs = make();
    const all = jobs.list({ status: [JobStatus.APPROVED] });
    expect(all.platforms).toEqual({ linkedin: 1, naukri: 1, instahyre: 1, other: 1 });
    const insta = jobs.list({ status: [JobStatus.APPROVED], platform: JobPlatform.INSTAHYRE });
    expect(insta.items.map((j) => j.site)).toEqual(['instahyre.com']);
    // Chip counts stay the same while one platform is selected.
    expect(insta.platforms).toEqual(all.platforms);
    expect(jobs.stats().queuedByPlatform).toEqual({ linkedin: 1, naukri: 1, instahyre: 1, other: 1 });
  });
});
