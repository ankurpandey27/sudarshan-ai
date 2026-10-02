// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { pickResume } from './pick-resume.util';

describe('picking the resume for a job', () => {
  const frontend = { id: 1, forJobs: ['frontend', 'react', 'ui'], skills: ['react', 'css', 'typescript'] };
  const data = { id: 2, forJobs: ['data engineer', 'etl'], skills: ['python', 'spark', 'sql'] };
  const job = (title: string, description = '') => ({ title, description });

  it('picks the one made for the job in its title', () => {
    expect(pickResume(job('Senior Frontend Engineer'), [frontend, data])).toBe(1);
    expect(pickResume(job('Data Engineer II', 'Build ETL with Spark'), [frontend, data])).toBe(2);
  });

  it('uses the description when the title says nothing', () => {
    expect(pickResume(job('Software Engineer', 'You will build our React UI'), [frontend, data])).toBe(1);
  });

  it('keeps your main resume when no extra one is about the job', () => {
    expect(pickResume(job('Backend Engineer', 'Node.js and AWS'), [frontend, data])).toBeNull();
  });

  it('matches whole words only - "ui" is not in "build"', () => {
    expect(pickResume(job('Build engineer'), [{ id: 3, forJobs: ['ui'], skills: [] }])).toBeNull();
  });

  it('keeps your main resume when two fit equally', () => {
    const a = { id: 4, forJobs: ['engineer'], skills: [] };
    const b = { id: 5, forJobs: ['engineer'], skills: [] };
    expect(pickResume(job('Engineer'), [a, b])).toBeNull();
  });
});
