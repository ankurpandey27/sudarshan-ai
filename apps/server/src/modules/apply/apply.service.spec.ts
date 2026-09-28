// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

// These tests never open a browser; puppeteer-core (ESM-only) cannot load in Jest before Node 24.9.
jest.mock('puppeteer-core', () => ({}));

import { JobPlatform } from '../jobs/enums/job-platform.enum';
import { JobSource } from '../jobs/enums/job-source.enum';
import { JobStatus } from '../jobs/enums/job-status.enum';
import { Job } from '../jobs/interfaces/job.interface';
import { ApplyService } from './apply.service';
import { PrepareStatus } from './enums/prepare-status.enum';
import { PrepareResult } from './interfaces/apply-adapter.interface';

const prep = (p: Partial<PrepareResult> & Pick<PrepareResult, 'status'>): PrepareResult => ({ scopeSelector: null, successPattern: /submitted/i, ...p });

const job = {
  id: 7,
  title: 'Node JS',
  company: 'Infosys',
  platform: JobPlatform.LINKEDIN,
  source: JobSource.LINKEDIN,
  attempts: 0,
  url: 'https://www.linkedin.com/jobs/view/7/',
} as Job;

/** ApplyService with only the parts a login page touches; `first` is what the LinkedIn step finds. */
const make = (first: PrepareResult) => {
  const markLoggedOut = jest.fn(async () => undefined);
  const setStatus = jest.fn();
  const page = { close: async () => undefined, url: () => 'https://career.infosys.com/login' };
  const service = new ApplyService(
    { matches: () => true, prepare: async () => first } as never,
    { matches: () => false } as never,
    { matches: () => false } as never,
    {
      matches: () => false,
      prepareUrl: async () => prep({ status: PrepareStatus.LOGIN_REQUIRED, detail: 'Log in to career.infosys.com in the agent browser' }),
    } as never,
    { busyWith: (fn: () => unknown) => fn(), newPage: async () => page, screenshot: async () => null, markLoggedOut } as never,
    {} as never,
    {} as never,
    { startAttempt: () => 1, setStatus, finishAttempt: () => undefined } as never,
    { clearForJob: () => undefined } as never,
    {} as never,
    { get: () => ({ sources: { externalSites: { enabled: true } }, agent: { pauseBeforeSubmit: false } }) } as never,
    { emit: () => undefined } as never,
    { watch: async () => undefined } as never,
    { state: () => ({ status: 'ok' }) } as never,
  );
  return { service, markLoggedOut, setStatus };
};

describe('ApplyService login pages', () => {
  it("never marks LinkedIn logged out for a company site's login page (Infosys, 2026-09-28)", async () => {
    const { service, markLoggedOut, setStatus } = make(prep({ status: PrepareStatus.EXTERNAL, externalUrl: 'https://career.infosys.com/job/1' }));
    const res = await service.apply(job);
    expect(markLoggedOut).not.toHaveBeenCalled();
    // That one job waits for you, with the company's login page open; it does not go back in the queue.
    expect(res.status).toBe(JobStatus.MANUAL);
    expect(setStatus).toHaveBeenLastCalledWith(job.id, JobStatus.MANUAL, 'Log in to career.infosys.com in the agent browser');
  });

  it('still notices when LinkedIn itself logged you out', async () => {
    const { service, markLoggedOut } = make(prep({ status: PrepareStatus.LOGIN_REQUIRED }));
    const res = await service.apply(job);
    expect(markLoggedOut).toHaveBeenCalledWith('linkedin');
    expect(res.status).toBe(JobStatus.APPROVED);
  });
});
