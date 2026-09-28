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
      jobs.setScore(
        id,
        p.score,
        { technical: 0, salary: 0, location: 0, engine: p.score, llm: null, matchedSkills: [], missingSkills: [], summary: '' },
        JobStatus.APPROVED,
        'ok',
      );
    }
    return jobs;
  };

  it('labels every job with its platform', () => {
    expect(platformOf(JobSource.WEB, 'https://www.instahyre.com/job-1/')).toBe(JobPlatform.INSTAHYRE);
    expect(platformOf(JobSource.WEB, 'https://jobs.lever.co/acme/1')).toBe(JobPlatform.OTHER);
    expect(platformOf(JobSource.WEB, 'https://careers.acme.com/1', 'https://instahyre.com/apply/1')).toBe(JobPlatform.INSTAHYRE);
    expect(
      make()
        .list({})
        .items.map((j) => j.platform)
        .sort(),
    ).toEqual(['instahyre', 'linkedin', 'naukri', 'other']);
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

describe('apply tries', () => {
  it('starts the count again when you approve a job yourself', () => {
    const jobs = new JobsService(new StorageService(':memory:'), new EventsService());
    const [id] = jobs.saveDiscovered([posting(JobSource.NAUKRI, 'nk', 'https://www.naukri.com/job-listings-x-123456789', 80)]);
    for (let i = 0; i < 3; i++) jobs.setStatus(id, JobStatus.APPLYING);
    jobs.setStatus(id, JobStatus.MANUAL, 'Tried 3 times without finishing');
    expect(jobs.get(id).attempts).toBe(3);
    jobs.setStatusMany([id], JobStatus.APPROVED, 'Approved by you', [JobStatus.MANUAL], true);
    expect(jobs.get(id).attempts).toBe(0);
    // Answering its questions puts it back in the queue without a fresh count.
    jobs.setStatus(id, JobStatus.APPLYING);
    jobs.setStatus(id, JobStatus.NEEDS_INPUT);
    jobs.setStatusMany([id], JobStatus.APPROVED, 'Your answer unblocked it', [JobStatus.NEEDS_INPUT]);
    expect(jobs.get(id).attempts).toBe(1);
  });
});

describe('the same job listed more than once', () => {
  const role = (externalId: string, location: string, title = 'Senior Developer (Node.js, React, PWA, MongoDB)', company = 'Emerson') => ({
    ...posting(JobSource.LINKEDIN, externalId, `https://www.linkedin.com/jobs/view/${externalId}/`, 83),
    title,
    company,
    location,
  });

  it('keeps one card when a search finds the same role in another city (Emerson, 2026-09-28)', () => {
    const jobs = new JobsService(new StorageService(':memory:'), new EventsService());
    const first = jobs.saveDiscovered([role('1001', 'Chandigarh, India')]);
    // The same search again, plus the Pune listing and one written slightly differently.
    const again = jobs.saveDiscovered([
      role('1001', 'Chandigarh, India'),
      role('1002', 'Pune Division, Maharashtra, India'),
      role('1003', 'Pune', 'senior developer - node.js react pwa mongodb'),
    ]);
    expect(first).toHaveLength(1);
    expect(again).toEqual([]);
    expect(jobs.get(first[0]).location).toBe('Chandigarh, India / Pune Division, Maharashtra, India');
    // A different role at the same company is still its own job.
    expect(jobs.saveDiscovered([role('1004', 'Pune', 'Staff Engineer')])).toHaveLength(1);
  });

  it('merges copies already in the list, never touching one that was applied', () => {
    const storage = new StorageService(':memory:');
    const jobs = new JobsService(storage, new EventsService());
    const now = new Date().toISOString();
    // Saved before the check existed: straight into the table.
    const ids = [role('1', 'Chandigarh'), role('2', 'Pune'), role('3', 'Noida')].map(
      (r) =>
        storage.run(
          "INSERT INTO jobs (source, external_id, url, title, company, location, status, discovered_at, updated_at, description, skills) VALUES ('linkedin', ?, ?, ?, ?, ?, 'approved', ?, ?, '', '[]')",
          [r.externalId, r.url, r.title, r.company, r.location, now, now],
        ).lastInsertRowid,
    );
    jobs.setStatus(ids[2], JobStatus.APPLIED, 'ok');
    expect(jobs.mergeSameRoles()).toBe(2);
    expect(jobs.get(ids[2]).status).toBe(JobStatus.APPLIED);
    expect(jobs.get(ids[2]).location).toBe('Noida / Chandigarh / Pune');
    expect([jobs.get(ids[0]).status, jobs.get(ids[1]).status]).toEqual([JobStatus.DISMISSED, JobStatus.DISMISSED]);
    expect(jobs.get(ids[0]).reason).toBe(`Same job as #${ids[2]} (another listing)`);
    expect(jobs.mergeSameRoles()).toBe(0);
  });
});
