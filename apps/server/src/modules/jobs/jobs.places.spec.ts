// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { EventsService } from '../../common/events/events.service';
import { StorageService } from '../../common/storage/storage.service';
import { JobRegion, WorkMode } from './enums/job-place.enum';
import { JobPlatform } from './enums/job-platform.enum';
import { JobSource } from './enums/job-source.enum';
import { JobStatus } from './enums/job-status.enum';
import { JobsService } from './jobs.service';
import { countryNames } from './utils/job-place.util';

function setup() {
  const storage = new StorageService(':memory:');
  const jobs = new JobsService(storage, new EventsService());
  const add = (id: string, location: string, score: number, opts: { remote?: boolean; posted?: string; source?: JobSource } = {}) => {
    const source = opts.source ?? JobSource.LINKEDIN;
    const [saved] = jobs.saveDiscovered([
      {
        source,
        externalId: id,
        url: source === JobSource.NAUKRI ? `https://www.naukri.com/job-listings-${id}` : `https://www.linkedin.com/jobs/view/${id}/`,
        title: `Backend ${id}`,
        company: `Co ${id}`,
        location,
        isRemote: !!opts.remote,
        easyApply: true,
        description: '',
        postedAt: opts.posted ?? null,
      },
    ]);
    storage.run('UPDATE jobs SET score = ?, status = ? WHERE id = ?', [score, JobStatus.REVIEW, saved]);
    return saved;
  };
  return { storage, jobs, add };
}

describe('Review filters and "your country first" (2026-10-06)', () => {
  it('classifies every job and filters by work type, region and how recent', () => {
    const { jobs, add } = setup();
    add('foreign', 'United States', 95, { remote: true });
    add('home-remote', 'Remote (India)', 80, { remote: true });
    add('home-hybrid', 'Hybrid - Bengaluru', 75, { source: JobSource.NAUKRI });
    add('home-onsite', 'Noida, Uttar Pradesh, India', 70, { posted: new Date(Date.now() - 20 * 86_400_000).toISOString() });
    add('bare', 'Remote', 65, { remote: true });
    expect(jobs.classifyPlaces({ country: countryNames('India'), ownPlaces: ['Noida'] })).toBe(5);

    const titles = (q: Parameters<JobsService['list']>[0]) => jobs.list({ status: [JobStatus.REVIEW], ...q }).items.map((j) => j.title.replace('Backend ', ''));
    expect(titles({ region: JobRegion.HOME })).toEqual(['home-remote', 'home-hybrid', 'home-onsite']);
    expect(titles({ region: JobRegion.ABROAD })).toEqual(['foreign']);
    expect(titles({ region: JobRegion.UNKNOWN })).toEqual(['bare']);
    expect(titles({ workMode: [WorkMode.REMOTE] })).toEqual(['foreign', 'home-remote', 'bare']);
    expect(titles({ workMode: [WorkMode.HYBRID, WorkMode.ONSITE] })).toEqual(['home-hybrid', 'home-onsite']);
    expect(titles({ withinDays: 7 })).not.toContain('home-onsite');
    // Newest first: the one posted 20 days ago comes last.
    expect(titles({ sort: 'newest' }).at(-1)).toBe('home-onsite');
  });

  it('"Approve all" approves only what the filters show', () => {
    const { jobs, add } = setup();
    add('foreign', 'United States', 95, { remote: true });
    add('home', 'Remote (India)', 90, { remote: true });
    jobs.classifyPlaces({ country: countryNames('India'), ownPlaces: [] });
    expect(jobs.approveStrong(80, undefined, { region: JobRegion.HOME })).toBe(1);
    expect(jobs.list({ status: [JobStatus.APPROVED] }).items.map((j) => j.title)).toEqual(['Backend home']);
  });

  it('applies to jobs in your country first, then unknown, then abroad - even when the foreign one scores higher', () => {
    const { jobs, add, storage } = setup();
    add('foreign', 'United States', 99, { remote: true });
    add('bare', 'Remote', 97, { remote: true });
    add('home', 'Remote (India)', 81, { remote: true });
    jobs.classifyPlaces({ country: countryNames('India'), ownPlaces: [] });
    storage.run('UPDATE jobs SET status = ?', [JobStatus.APPROVED]);
    const order: string[] = [];
    for (let i = 0; i < 3; i++) {
      const next = jobs.nextToApply([JobPlatform.LINKEDIN], true)!;
      order.push(next.title.replace('Backend ', ''));
      storage.run('UPDATE jobs SET status = ? WHERE id = ?', [JobStatus.APPLIED, next.id]);
    }
    expect(order).toEqual(['home', 'bare', 'foreign']);
  });

  it('with the setting off, the best match goes first as before', () => {
    const { jobs, add, storage } = setup();
    add('foreign', 'United States', 99, { remote: true });
    add('home', 'Remote (India)', 81, { remote: true });
    jobs.classifyPlaces({ country: countryNames('India'), ownPlaces: [] });
    storage.run('UPDATE jobs SET status = ?', [JobStatus.APPROVED]);
    expect(jobs.nextToApply([JobPlatform.LINKEDIN], false)?.title).toBe('Backend foreign');
  });

  it('works places out again when your country changes', () => {
    const { jobs, add } = setup();
    add('a', 'Toronto, Ontario, Canada', 90);
    jobs.classifyPlaces({ country: countryNames('India'), ownPlaces: [] });
    expect(jobs.list({}).items[0].region).toBe(JobRegion.ABROAD);
    jobs.classifyPlaces({ country: countryNames('Canada'), ownPlaces: [] }, true);
    expect(jobs.list({}).items[0].region).toBe(JobRegion.HOME);
  });
});

describe('the Approved tab lists jobs in the order they will be applied', () => {
  it('sort=queue with homeFirst matches nextToApply', () => {
    const { jobs, add, storage } = setup();
    add('foreign', 'United States', 99, { remote: true });
    add('home', 'Remote (India)', 81, { remote: true });
    jobs.classifyPlaces({ country: countryNames('India'), ownPlaces: [] });
    storage.run('UPDATE jobs SET status = ?', [JobStatus.APPROVED]);
    const listed = jobs.list({ status: [JobStatus.APPROVED], sort: 'queue', homeFirst: true }).items.map((j) => j.title);
    expect(listed).toEqual(['Backend home', 'Backend foreign']);
    expect(listed[0]).toBe(jobs.nextToApply([JobPlatform.LINKEDIN], true)?.title);
    expect(jobs.list({ status: [JobStatus.APPROVED], sort: 'queue' }).items[0].title).toBe('Backend foreign');
  });
});

describe('excluding words, as whole words (command bar: "skip anything asking Java")', () => {
  it('drops jobs that mention the word, keeps ones that only contain it inside another word', () => {
    const { jobs, storage } = setup();
    const save = (id: string, title: string, description: string) => {
      const [saved] = jobs.saveDiscovered([{ source: JobSource.LINKEDIN, externalId: id, url: `https://www.linkedin.com/jobs/view/${id}/`, title, company: 'Acme', location: 'Pune', isRemote: false, easyApply: true, description }]);
      storage.run('UPDATE jobs SET status = ?, score = 90 WHERE id = ?', [JobStatus.REVIEW, saved]);
    };
    save('1', 'Backend Engineer', 'Java/J2EE and Spring');
    save('2', 'Frontend Engineer', 'JavaScript and React');
    save('3', 'Node.js Developer', 'TypeScript');
    expect(jobs.list({ status: [JobStatus.REVIEW], exclude: ['java'] }).items.map((j) => j.title).sort()).toEqual(['Frontend Engineer', 'Node.js Developer']);
    expect(jobs.approveStrong(80, undefined, { exclude: ['java', 'react'] })).toBe(1);
  });
});
