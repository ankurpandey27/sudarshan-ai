// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

// These tests never open a browser; puppeteer-core (ESM-only) cannot load in Jest before Node 24.9.
jest.mock('puppeteer-core', () => ({}));

import { EventsService } from '../../common/events/events.service';
import { StorageService } from '../../common/storage/storage.service';
import { JobPlatform } from '../jobs/enums/job-platform.enum';
import { JobSource } from '../jobs/enums/job-source.enum';
import { JobStatus } from '../jobs/enums/job-status.enum';
import { JobsService } from '../jobs/jobs.service';
import { AgentService } from './agent.service';

describe('AgentService.applyNow', () => {
  it('never runs two applications at once, even while the browser is still starting', async () => {
    let browserUp!: () => void;
    const apply = jest.fn(async () => ({ status: 'applied', detail: 'ok' }));
    // Only the parts applyNow touches.
    const agent = Object.assign(Object.create(AgentService.prototype) as object, {
      applying: null,
      running: false,
      jobs: { get: (id: number) => ({ id, title: 'Backend', company: 'Acme' }) },
      browser: { ensure: () => new Promise<void>((r) => (browserUp = r)) },
      apply: { apply },
      setPhase: () => undefined,
    }) as unknown as AgentService;

    const first = agent.applyNow(1);
    // A second click (or the agent loop) arrives while the browser is still launching.
    expect(await agent.applyNow(2)).toEqual({ status: 'busy', detail: 'Another application is in progress' });
    browserUp();
    expect(await first).toEqual({ status: 'applied', detail: 'ok' });
    expect(apply).toHaveBeenCalledTimes(1);
    // Free again afterwards.
    expect((agent as unknown as { applying: unknown }).applying).toBeNull();
  });
});

describe('AgentService daily limits', () => {
  it('moves on to other platforms when the best queued job is on a platform at its limit', async () => {
    const jobs = new JobsService(new StorageService(':memory:'), new EventsService());
    const add = (source: JobSource, id: string, url: string, score: number) => {
      const [jobId] = jobs.saveDiscovered([
        { source, externalId: id, url, title: id, company: 'Acme', location: 'Pune', isRemote: false, easyApply: true, description: '' },
      ]);
      jobs.setScore(
        jobId,
        score,
        { technical: 0, salary: 0, location: 0, engine: score, llm: null, matchedSkills: [], missingSkills: [], summary: '' },
        JobStatus.APPROVED,
        'ok',
      );
      return jobId;
    };
    // Naukri already applied once today with a limit of 1, and its job is the best in the queue.
    const done = add(JobSource.NAUKRI, 'nk-done', 'https://www.naukri.com/job-listings-a-111111111', 50);
    jobs.setStatus(done, JobStatus.APPLIED, 'ok');
    add(JobSource.NAUKRI, 'nk-next', 'https://www.naukri.com/job-listings-b-222222222', 99);
    add(JobSource.WEB, 'ih', 'https://www.instahyre.com/job-12345-backend-engineer/', 70);
    const on = (dailyLimit: number) => ({ enabled: true, dailyLimit });
    const agent = Object.assign(Object.create(AgentService.prototype) as object, {
      jobs,
      blocked: [],
      settings: { get: () => ({ sources: { linkedin: on(45), naukri: on(1), instahyre: on(45), indeed: on(45), links: on(45), externalSites: on(45) } }) },
      health: { state: () => ({ status: 'ok' }) },
      browser: { isLoggedIn: async () => true },
      events: { emit: () => undefined },
    }) as unknown as { eligiblePlatforms(): Promise<JobPlatform[]>; jobs: JobsService };

    const platforms = await agent.eligiblePlatforms();
    expect(platforms).not.toContain(JobPlatform.NAUKRI);
    expect(jobs.nextToApply(platforms)?.title).toBe('ih');
  });
});
