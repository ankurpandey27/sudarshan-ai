// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { coreSkillIn, coreSkillsOf, skillLabel } from './core-skill.util';

const you = {
  coreSkills: [],
  keywords: ['Nodejs'],
  profileSkills: ['Node.js', 'NestJS', 'React', 'MongoDB'],
  currentTitle: 'Senior Software Engineer',
  headline: '',
};
const job = (title: string, skills: string[] = [], description = '') => ({ title, skills, description });

describe('core skills', () => {
  it('works them out from what you search for when you set none', () => {
    expect(coreSkillsOf(you)).toEqual(['node.js']);
    expect(coreSkillsOf({ ...you, keywords: [], headline: 'Node.js and NestJS backend developer' })).toEqual(['node.js', 'nestjs']);
  });

  it('uses the ones you set, as you wrote them', () => {
    expect(coreSkillsOf({ ...you, coreSkills: ['NestJS', ' '] })).toEqual(['nestjs']);
  });

  it('finds a core skill in the skill list, the title or the description, however it is written', () => {
    const core = ['node.js'];
    // Skipped on 2026-09-28 as "Title does not match your search".
    expect(coreSkillIn(job('Full Stack Engineer', ['JavaScript', 'Node.js', 'Angular']), core)).toBe('node.js');
    expect(coreSkillIn(job('NodeJS Backend developer'), core)).toBe('node.js');
    expect(coreSkillIn(job('Founding Engineer', [], 'You will build APIs in Node.js and TypeScript.'), core)).toBe('node.js');
    for (const spelled of ['Node JS Developer', 'Node-JS Engineer', 'Backend (NodeJs)']) expect(coreSkillIn(job(spelled), core)).toBe('node.js');
    expect(coreSkillIn(job('Senior Engineer', [], 'Nest.js microservices'), ['nestjs'])).toBe('nestjs');
    // Not fooled by look-alikes.
    expect(coreSkillIn(job('Python Developer', ['python', 'flask'], 'Nodes and clusters, jsonschema'), core)).toBe(null);
  });

  it('reads well in a reason', () => {
    expect(skillLabel('node.js')).toBe('Node.js');
  });
});
