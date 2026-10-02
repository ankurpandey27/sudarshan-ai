// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { hasSkill } from './has-skill.util';

describe('hasSkill', () => {
  const have = new Set(['mysql', 'postgresql', 'nestjs', 'aws']);
  it.each(['SQL', 'sql', 'Node.js', 'NodeJS', 'cloud', 'Postgres'])('counts %s as yours', (s) => expect(hasSkill(have, s)).toBe(true));
  it.each(['Java', 'Kubernetes', 'NoSQL'])('does not count %s', (s) => expect(hasSkill(have, s)).toBe(false));
});
