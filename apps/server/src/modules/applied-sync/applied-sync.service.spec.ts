// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

// These tests never open a browser; puppeteer-core (ESM-only) cannot load in Jest before Node 24.9.
jest.mock('puppeteer-core', () => ({}));

import { EventsService } from '../../common/events/events.service';
import { StorageService } from '../../common/storage/storage.service';
import { JobSource } from '../jobs/enums/job-source.enum';
import { JobStatus } from '../jobs/enums/job-status.enum';
import { JobsService } from '../jobs/jobs.service';
import { AppliedSyncService } from './applied-sync.service';
import { CONFIRMED_ON_INDEED } from './constants/applied-sync.constants';

const make = () => {
  const storage = new StorageService(':memory:');
  const jobs = new JobsService(storage, new EventsService());
  const add = (jk: string, title: string, status: JobStatus, source = JobSource.INDEED) => {
    const [id] = jobs.saveDiscovered([
      {
        source,
        externalId: jk,
        url: `https://in.indeed.com/viewjob?jk=${jk}`,
        title,
        company: `Co ${jk}`,
        location: 'Noida',
        isRemote: false,
        easyApply: true,
        description: '',
      },
    ]);
    jobs.setStatus(id, status);
    return id;
  };
  const sync = new AppliedSyncService({} as never, jobs, new EventsService());
  return { storage, jobs, add, sync };
};

describe('AppliedSyncService.markApplied (Indeed)', () => {
  it('marks exactly the jobs Indeed lists, by its job id, and counts the rest', () => {
    const { jobs, add, sync, storage } = make();
    // Finished by hand in a tab Sudarshan left open (2026-09-28).
    const byHand = add('aaaaaaaaaaaaaaaa', 'Backend Developer', JobStatus.MANUAL);
    storage.run("INSERT INTO attempts (job_id, started_at) VALUES (?, '2026-09-27T10:00:00.000Z')", [byHand]);
    const queued = add('bbbbbbbbbbbbbbbb', 'Node.js Engineer', JobStatus.APPROVED);
    const done = add('cccccccccccccccc', 'Full Stack Developer', JobStatus.APPLIED);
    // Not on Indeed's list: never touched, even with a similar title.
    const other = add('dddddddddddddddd', 'Backend Developer', JobStatus.MANUAL);

    const r = sync.markApplied(['AAAAAAAAAAAAAAAA', 'bbbbbbbbbbbbbbbb', 'cccccccccccccccc', 'eeeeeeeeeeeeeeee']);

    expect(r.listed).toBe(4);
    expect(r.marked.map((m) => m.id).sort()).toEqual([byHand, queued].sort());
    expect(r.alreadyApplied).toBe(1);
    expect(r.notInSudarshan).toBe(1);
    expect(jobs.get(byHand)).toMatchObject({ status: JobStatus.APPLIED, reason: CONFIRMED_ON_INDEED });
    // A queued job Indeed says you applied to is not sent again.
    expect(jobs.get(queued).status).toBe(JobStatus.APPLIED);
    expect(jobs.get(done).status).toBe(JobStatus.APPLIED);
    expect(jobs.get(other).status).toBe(JobStatus.MANUAL);
  });

  it("dates it when Sudarshan handed it to you, so today's daily limit is not used up", () => {
    const { jobs, add, sync, storage } = make();
    const id = add('aaaaaaaaaaaaaaaa', 'Backend Developer', JobStatus.MANUAL);
    storage.run("INSERT INTO attempts (job_id, started_at) VALUES (?, '2026-09-20T08:00:00.000Z')", [id]);
    sync.markApplied(['aaaaaaaaaaaaaaaa']);
    expect(jobs.get(id).appliedAt).toBe('2026-09-20T08:00:00.000Z');
  });

  it('only matches Indeed jobs, and does nothing with an empty list', () => {
    const { jobs, add, sync } = make();
    const linkedin = add('aaaaaaaaaaaaaaaa', 'Backend Developer', JobStatus.MANUAL, JobSource.LINKEDIN);
    expect(sync.markApplied(['aaaaaaaaaaaaaaaa']).marked).toEqual([]);
    expect(jobs.get(linkedin).status).toBe(JobStatus.MANUAL);
    expect(sync.markApplied([])).toEqual({ listed: 0, marked: [], alreadyApplied: 0, notInSudarshan: 0 });
  });
});
