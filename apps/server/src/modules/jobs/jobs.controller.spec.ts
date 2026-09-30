// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { EventsService } from '../../common/events/events.service';
import { StorageService } from '../../common/storage/storage.service';
import { JobSource } from './enums/job-source.enum';
import { JobStatus } from './enums/job-status.enum';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

describe('moving jobs between Review, the queue and Skipped', () => {
  const make = () => {
    const jobs = new JobsService(new StorageService(':memory:'), new EventsService());
    const add = (id: string, status: JobStatus) => {
      const [jobId] = jobs.saveDiscovered([
        {
          source: JobSource.LINKEDIN,
          externalId: id,
          url: `https://www.linkedin.com/jobs/view/${id}/`,
          // A distinct role per job: the same title at the same company is one job.
          title: `Backend ${id}`,
          company: 'Acme',
          location: '',
          isRemote: false,
          easyApply: true,
          description: '',
        },
      ]);
      jobs.setStatus(jobId, status);
      return jobId;
    };
    return { jobs, add, ctl: new JobsController(jobs, { getOrThrow: () => '' } as never) };
  };

  it('takes queued (and skipped) jobs back to review', () => {
    const { jobs, add, ctl } = make();
    const queued = add('100001', JobStatus.APPROVED);
    const skipped = add('100002', JobStatus.SKIPPED);
    expect(ctl.unqueue({ ids: [queued, skipped] }).updated).toBe(2);
    expect(jobs.get(queued).status).toBe(JobStatus.REVIEW);
    expect(jobs.get(skipped).status).toBe(JobStatus.REVIEW);
  });

  it('skips jobs from review or the queue', () => {
    const { jobs, add, ctl } = make();
    const review = add('100003', JobStatus.REVIEW);
    const queued = add('100004', JobStatus.APPROVED);
    expect(ctl.skip({ ids: [review, queued] }).updated).toBe(2);
    expect(jobs.get(review).status).toBe(JobStatus.SKIPPED);
    expect(jobs.get(queued).status).toBe(JobStatus.SKIPPED);
  });

  it('never pulls a job the agent is applying to right now, or one already applied', () => {
    const { jobs, add, ctl } = make();
    const applying = add('100005', JobStatus.APPLYING);
    const applied = add('100006', JobStatus.APPLIED);
    expect(ctl.unqueue({ ids: [applying, applied] }).updated).toBe(0);
    expect(ctl.skip({ ids: [applying, applied] }).updated).toBe(0);
    expect(jobs.get(applying).status).toBe(JobStatus.APPLYING);
    expect(jobs.get(applied).status).toBe(JobStatus.APPLIED);
  });

  it("rescoring re-checks the agent's own decisions but never undoes yours", () => {
    const { jobs, add, ctl } = make();
    const agentSkipped = add('100007', JobStatus.SKIPPED);
    const agentReview = add('100008', JobStatus.REVIEW);
    const youSkipped = add('100009', JobStatus.REVIEW);
    const youReviewed = add('100010', JobStatus.APPROVED);
    ctl.skip({ ids: [youSkipped] });
    ctl.unqueue({ ids: [youReviewed] });

    expect(jobs.resetForRescore()).toBe(2);
    expect(jobs.get(agentSkipped).status).toBe(JobStatus.NEW);
    expect(jobs.get(agentReview).status).toBe(JobStatus.NEW);
    expect(jobs.get(youSkipped).status).toBe(JobStatus.SKIPPED);
    expect(jobs.get(youReviewed).status).toBe(JobStatus.REVIEW);
  });

  it('approves every strong match in Review, across all pages, and leaves weak ones', () => {
    const { jobs, add, ctl } = make();
    const ids = Array.from({ length: 30 }, (_, i) => add(String(200000 + i), JobStatus.REVIEW));
    ids.forEach((id, i) => jobs.setScore(id, i < 25 ? 80 : 40, null as never, JobStatus.REVIEW, 'scored'));
    expect(jobs.list({ status: [JobStatus.REVIEW], minScore: 70, limit: 1 }).total).toBe(25);
    expect(ctl.approveStrong({ minScore: 70 }).updated).toBe(25);
    expect(jobs.list({ status: [JobStatus.REVIEW] }).total).toBe(5);
    expect(jobs.get(ids[24]).status).toBe(JobStatus.APPROVED);
  });
});
