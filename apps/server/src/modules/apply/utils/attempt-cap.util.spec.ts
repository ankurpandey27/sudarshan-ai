// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { JobStatus } from '../../jobs/enums/job-status.enum';
import { capAttempts } from './attempt-cap.util';

describe('capAttempts', () => {
  const back = { status: JobStatus.APPROVED, detail: 'The form did not move forward', ended: 'run:stuck' };

  it('lets a job go back to the queue on its first and second tries', () => {
    expect(capAttempts(back, 0).status).toBe(JobStatus.APPROVED);
    expect(capAttempts(back, 1).status).toBe(JobStatus.APPROVED);
  });

  it('sends it to "Do by hand" on the third try, saying why', () => {
    const out = capAttempts(back, 2);
    expect(out.status).toBe(JobStatus.MANUAL);
    expect(out.detail).toBe('Tried 3 times without finishing - The form did not move forward');
    // Answering its questions again would lead to the same form: that loop stops too.
    expect(capAttempts({ status: JobStatus.NEEDS_INPUT, detail: 'Naukri asks: "x"' }, 2).status).toBe(JobStatus.MANUAL);
  });

  it('never caps a finished job, or one waiting for you to log in', () => {
    expect(capAttempts({ status: JobStatus.APPLIED, detail: 'ok' }, 5).status).toBe(JobStatus.APPLIED);
    expect(capAttempts({ status: JobStatus.APPROVED, detail: 'Waiting for you to log in', ended: 'prep:login_required' }, 5).status).toBe(JobStatus.APPROVED);
  });
});
