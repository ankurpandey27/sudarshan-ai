// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { TasteFeaturesInput } from '../interfaces/taste.interface';
import { buildProfile, interestOf, jobSkills } from './interest.util';

const job = (title: string, platform: string, matched: string[], missing: string[] = []): TasteFeaturesInput => ({
  title,
  platform,
  isRemote: false,
  easyApply: true,
  score: 70,
  detail: { matchedSkills: matched, missingSkills: missing },
});
const times = (n: number, y: 0 | 1, j: TasteFeaturesInput) => Array.from({ length: n }, () => ({ y, job: j }));

// Like your decisions on 2026-09-28: hundreds kept, very few skipped.
const yours = buildProfile([
  ...times(60, 1, job('Senior Backend Developer', 'linkedin', ['node.js', 'typescript', 'aws'])),
  ...times(40, 1, job('Full Stack Developer', 'linkedin', ['node.js', 'react', 'javascript'])),
  ...times(30, 1, job('Backend Engineer', 'naukri', ['node.js', 'postgresql', 'aws'])),
  ...times(10, 1, job('Software Engineer', 'instahyre', ['node.js', 'mongodb'])),
  ...times(6, 0, job('Engineering Manager', 'linkedin', ['node.js'])),
]);

describe('your interest', () => {
  it('scores a job like the ones you apply to in the 90s', () => {
    const p = interestOf(yours, job('Backend Developer', 'linkedin', ['node.js', 'typescript', 'aws'])).p;
    expect(p).toBeGreaterThanOrEqual(0.9);
  });

  it('spreads out: a Node.js full-stack job high, a Java job low - not everything 92-99%', () => {
    const fullStack = interestOf(yours, job('Full Stack Developer', 'linkedin', ['node.js', 'react'])).p;
    const java = interestOf(yours, job('Java Developer', 'linkedin', [], ['java', 'spring', 'hibernate'])).p;
    expect(fullStack).toBeGreaterThanOrEqual(0.8);
    expect(java).toBeLessThan(0.35);
  });

  it('never says "not Node.js" for a job asking for your main skill (the old model did)', () => {
    const r = interestOf(yours, job('Full Stack Engineer', 'linkedin', ['node.js', 'react', 'javascript'])).reasons;
    expect(r[0]).toBe('+ skill: node.js');
    expect(r.join()).not.toMatch(/- skill: node\.js/);
  });

  it('says what counts against a job: something you turn down, or skills you never apply for', () => {
    const manager = interestOf(yours, job('Engineering Manager', 'linkedin', ['node.js']));
    // Both words only ever appeared in jobs you turned down.
    expect(manager.reasons.slice(0, 2)).toEqual(expect.arrayContaining(['- title: manager', '- title: engineering']));
    expect(manager.p).toBeLessThan(interestOf(yours, job('Backend Engineer', 'linkedin', ['node.js'])).p);
    expect(interestOf(yours, job('Java Developer', 'linkedin', [], ['java'])).reasons).toContain('- skill: java');
  });

  it('reads the skills a job asks for, whether you have them or not', () => {
    expect(jobSkills(job('x', 'linkedin', ['Node.js', 'AWS'], ['Java', 'aws']))).toEqual(['node.js', 'aws', 'java']);
    expect(jobSkills({ ...job('x', 'linkedin', []), detail: null })).toEqual([]);
  });

  it('counts what a job does not say as unknown - not a perfect match', () => {
    // Title and platform like yours, but no skills listed: in the middle-upper range, never 100%.
    const noSkills = interestOf(yours, { ...job('Senior Backend Developer', 'linkedin', []), detail: null }).p;
    expect(noSkills).toBeGreaterThanOrEqual(0.6);
    expect(noSkills).toBeLessThan(0.8);
    // Nothing readable at all (a title in another script, no skills): about the middle.
    expect(interestOf(yours, { ...job('נציג תפעול', 'other', []), detail: null }).p).toBeLessThan(0.5);
  });
});
