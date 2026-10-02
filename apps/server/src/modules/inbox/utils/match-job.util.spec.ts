// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { MailMessage } from '../interfaces/inbox.interface';
import { companyKey, matchJob } from './match-job.util';

describe('which application a reply is about', () => {
  const jobs = [
    { id: 1, title: 'Backend Engineer', company: 'Acme Technologies Pvt. Ltd.', appliedAt: '2026-09-20T10:00:00Z' },
    { id: 2, title: 'Senior Frontend Developer', company: 'Acme Technologies Pvt. Ltd.', appliedAt: '2026-09-25T10:00:00Z' },
    { id: 3, title: 'Node.js Developer', company: 'Zeta Labs', appliedAt: '2026-09-22T10:00:00Z' },
    { id: 4, title: 'SDE II', company: 'Go', appliedAt: '2026-09-22T10:00:00Z' },
  ];
  const mail = (from: string, subject: string, text = '', at = '2026-10-01T10:00:00Z'): MailMessage => ({ id: 'm', from, fromName: '', subject, text, at });

  it('leaves out the legal words of a company name', () => {
    expect(companyKey('Acme Technologies Pvt. Ltd.')).toBe('acme');
    expect(companyKey('The Zeta Group India')).toBe('zeta');
  });

  it('knows mail from the company domain', () => {
    expect(matchJob(mail('hr@zetalabs.com', 'Your application'), jobs)).toBe(3);
  });

  it('finds the company named by a job board or ATS sender', () => {
    expect(matchJob(mail('no-reply@greenhouse.io', 'Thank you for applying to Zeta Labs'), jobs)).toBe(3);
  });

  it('picks the role the reply names when you applied twice to a company', () => {
    expect(matchJob(mail('careers@acme.com', 'Update on your application', 'Thanks for applying for Backend Engineer.'), jobs)).toBe(1);
    expect(matchJob(mail('careers@acme.com', 'Update on your application'), jobs)).toBe(2);
  });

  it('never matches a short or common company name by chance, or a reply older than the application', () => {
    expect(matchJob(mail('jobs@lever.co', 'Lets go! Your application'), jobs)).toBeNull();
    expect(matchJob(mail('hr@zetalabs.com', 'Your application', '', '2026-09-01T00:00:00Z'), jobs)).toBeNull();
    expect(matchJob(mail('friend@gmail.com', 'Interview tips'), jobs)).toBeNull();
  });
});
