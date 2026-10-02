// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { StorageService } from '../../common/storage/storage.service';
import { EventsService } from '../../common/events/events.service';
import { JobsService } from './jobs.service';
import { JobStatus } from './enums/job-status.enum';
import { INTERRUPTED_AFTER_SEND } from './constants/jobs.constants';

describe('a shutdown in the middle of an application', () => {
  const setup = () => {
    const storage = new StorageService(':memory:');
    const jobs = new JobsService(storage, new EventsService(storage));
    const add = (n: number) => {
      const now = new Date().toISOString();
      storage.run(
        "INSERT INTO jobs (id, source, external_id, url, title, company, status, discovered_at, updated_at) VALUES (?, 'url', ?, ?, 'Engineer', ?, ?, ?, ?)",
        [n, `x${n}`, `https://jobs.example.com/${n}`, `Company ${n}`, JobStatus.APPLYING, now, now],
      );
      return jobs.startAttempt(n);
    };
    return { storage, jobs, add };
  };

  it('queues again a job stopped before Submit was pressed', () => {
    const { jobs, add } = setup();
    add(1);
    jobs.recoverInterrupted();
    expect(jobs.get(1).status).toBe(JobStatus.APPROVED);
  });

  it('never queues again a job stopped right after Submit - you check it instead', () => {
    const { jobs, add } = setup();
    const attempt = add(2);
    jobs.markSent(attempt);
    jobs.recoverInterrupted();
    const job = jobs.get(2);
    expect(job.status).toBe(JobStatus.MANUAL);
    expect(job.reason).toBe(INTERRUPTED_AFTER_SEND);
  });

  it('ends the unfinished attempts either way', () => {
    const { storage, jobs, add } = setup();
    add(3);
    jobs.markSent(add(4));
    jobs.recoverInterrupted();
    expect(storage.all("SELECT id FROM attempts WHERE finished_at IS NULL OR outcome <> 'interrupted'")).toEqual([]);
  });

  it('a Submit pressed in an earlier, finished attempt does not count', () => {
    const { storage, jobs, add } = setup();
    jobs.markSent(add(5));
    storage.run("UPDATE attempts SET finished_at = ?, outcome = 'stuck'", [new Date().toISOString()]);
    jobs.startAttempt(5);
    jobs.recoverInterrupted();
    expect(jobs.get(5).status).toBe(JobStatus.APPROVED);
  });
});
