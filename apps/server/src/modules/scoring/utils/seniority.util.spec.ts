// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { belowLevel, levelFor, yearsAsked } from './seniority.util';

const job = (title: string, url = 'https://www.linkedin.com/jobs/view/1/', description = '') => ({ title, url, description });

describe('experience level (2026-09-30)', () => {
  it('works out your level: 3 for 4.9 years, nothing for a fresher, or what you set', () => {
    expect(levelFor(null, 4.9)).toBe(3);
    expect(levelFor(null, 2)).toBe(1);
    expect(levelFor(null, 0)).toBe(0);
    expect(levelFor(5, 4.9)).toBe(5);
    expect(levelFor(0, 4.9)).toBe(0);
  });

  it.each([
    'Node . js Backend Intern',
    'Full Stack Developer Intern (NodeJS, ExpressJS, ReactJS, MongoDB, JS)',
    'Full Stack Development Internship in Noida (Hybrid)',
    'Software Developer Freshers',
    'Graduate Trainee - Software',
    'Junior Node.js Developer',
    'Werkstudent Backend (m/w/d)',
  ])('skips "%s" for someone with experience', (title) => expect(belowLevel(job(title), 3)).not.toBeNull());

  it('reads the experience a job asks for, from its title, Naukri address or description', () => {
    expect(yearsAsked('Node.js Developer (0-2 years)', '', '')).toEqual({ min: 0, max: 2 });
    expect(
      yearsAsked('Backend Engineer', 'https://www.naukri.com/job-listings-senior-full-stack-developer-octalogic-tech-panaji-3-to-7-years-210926005979', ''),
    ).toEqual({ min: 3, max: 7 });
    expect(yearsAsked('Backend Engineer', '', 'We need 1 to 2 yrs of experience with Node.js.')).toEqual({ min: 1, max: 2 });
    expect(yearsAsked('Backend Engineer', '', 'Requirements: 5+ years building APIs')).toEqual({ min: 5, max: null });
    expect(yearsAsked('Backend Engineer', '', 'Minimum 2 years of experience')).toEqual({ min: 2, max: null });
    expect(yearsAsked('Backend Engineer', '', 'Great team, flexible hours.')).toBeNull();
  });

  it('keeps 3+, 4+ and 5+ roles, and ones that say nothing about experience', () => {
    for (const t of ['Senior Node.js Engineer (5+ years)', 'Backend Developer 3-7 years', 'Node.js Developer (4 to 8 years)', 'Backend Engineer']) {
      expect(belowLevel(job(t), 3)).toBeNull();
    }
    // "2-5 years": you are within it - kept.
    expect(belowLevel(job('Node.js Developer', '', 'Experience: 2-5 years'), 3)).toBeNull();
  });

  it('skips jobs whose most asked is below your level', () => {
    expect(belowLevel(job('Node.js Developer', '', 'Experience: 0-2 years'), 3)).toMatch(/0-2 years - below your level \(3\+\)/);
    expect(belowLevel(job('Backend Developer', 'https://www.naukri.com/job-listings-backend-developer-acme-noida-0-to-1-years-123'), 3)).not.toBeNull();
  });

  it('keeps senior and lead roles that mention juniors, and skips nothing for a fresher', () => {
    expect(belowLevel(job('Senior Engineer - mentor junior developers'), 3)).toBeNull();
    expect(belowLevel(job('Tech Lead (manage interns)'), 3)).toBeNull();
    expect(belowLevel(job('Node.js Intern'), 0)).toBeNull();
  });

  it('is not fooled by salaries or dates', () => {
    expect(yearsAsked('Developer', '', 'CTC 12-18 LPA, joining in 2026. Office 10 to 6.')).toBeNull();
  });

  it('reads the role, not a single-skill line, and lets the years beat the word (your jobs, 2026-09-30)', () => {
    expect(belowLevel(job('Junior Architect - Nodejs+ AWS+ typescript | 10 - 15 Yr'), 3)).toBeNull();
    expect(belowLevel(job('Senior SDE (Backend)', '', 'Must have 1-2 years with Kafka.'), 3)).toBeNull();
    expect(belowLevel(job('Nodejs Developer Lead', '', '0-2 years of team leading'), 3)).toBeNull();
    expect(belowLevel(job('Backend Developer', '', '5+ years overall; 1-2 years with Docker'), 3)).toBeNull();
    expect(belowLevel(job('Node.js Developer', '', 'Experience: 1-2 years in Node.js'), 3)).not.toBeNull();
  });
});
