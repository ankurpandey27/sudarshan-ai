// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { CandidateProfile } from '../interfaces/candidate-profile.interface';
import { buildProfileCheck } from './profile-check.util';

describe('profile check', () => {
  const profile = (skills: [string, number | null][], extra: Partial<CandidateProfile> = {}) =>
    ({ headline: 'Backend Engineer', summary: 'I build APIs', skills: skills.map(([name, years]) => ({ name, years })), ...extra }) as CandidateProfile;
  const jobs = (n: number, skills: string[], missing: string[] = skills) => Array.from({ length: n }, () => ({ skills, missing }));

  it('offers SQL in one click when you list MySQL and PostgreSQL, instead of calling it missing', () => {
    const check = buildProfileCheck({
      profile: profile([['MySQL', 4], ['PostgreSQL', 3], ['Node.js', 5]]),
      resumeText: '',
      jobs: jobs(10, ['sql', 'node.js'], ['sql']),
      stories: 5,
    });
    expect(check.quickAdds).toEqual([{ skill: 'sql', jobs: 10, why: 'covered', coveredBy: ['MySQL', 'PostgreSQL'] }]);
    expect(check.missing).toEqual([]);
  });

  it('offers what is on your resume but not in your skills, and only lists the rest as "if you have it"', () => {
    const check = buildProfileCheck({
      profile: profile([['Node.js', 5]]),
      resumeText: 'Built services on Kubernetes and Redis at Acme.',
      jobs: [...jobs(6, ['kubernetes', 'azure']), ...jobs(4, ['Golang']), ...jobs(3, ['go'])],
      stories: 5,
    });
    expect(check.quickAdds.map((g) => [g.skill, g.why])).toEqual([['kubernetes', 'on_resume']]);
    // "Golang" and "go" are one skill.
    expect(check.missing.map((g) => [g.skill, g.jobs])).toEqual([
      ['go', 7],
      ['azure', 6],
    ]);
  });

  it('ignores kinds of role, rare skills and ones you already have, under any spelling', () => {
    const check = buildProfileCheck({
      profile: profile([['Golang', 2], ['ReactJS', 3]]),
      resumeText: '',
      jobs: [...jobs(9, ['backend', 'full stack', 'go', 'react']), ...jobs(2, ['rust'])],
      stories: 5,
    });
    expect(check.quickAdds).toEqual([]);
    expect(check.missing).toEqual([]);
  });

  it('points out skills without years, and an empty headline, summary or Story Bank', () => {
    const check = buildProfileCheck({ profile: profile([['Node.js', null], ['AWS', 2]], { headline: '', summary: '' }), resumeText: '', jobs: [], stories: 1 });
    expect(check.noYears).toEqual(['Node.js']);
    expect(check.tips.map((t) => t.id)).toEqual(['headline', 'summary', 'stories']);
  });
});
