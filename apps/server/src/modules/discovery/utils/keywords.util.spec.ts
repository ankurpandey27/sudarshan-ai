// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { anyOf } from './keywords.util';

describe('anyOf', () => {
  it('joins your keywords into one "any of these" search, keeping phrases together', () => {
    expect(anyOf(['Nodejs', 'nestjs', 'express.js'])).toBe('Nodejs OR nestjs OR express.js');
    expect(anyOf(['Node.js Developer', ' ', 'NestJS'])).toBe('"Node.js Developer" OR NestJS');
  });
});
