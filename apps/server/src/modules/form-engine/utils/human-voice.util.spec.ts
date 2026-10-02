// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { aiTells, isWrittenAnswer, plainWords } from './human-voice.util';

describe('Written answers that read like the candidate wrote them (2026-10-01)', () => {
  const ai =
    "In today's fast-paced world, I leverage robust Node.js skills — and I spearheaded seamless migrations — it's not just code, it's impact. I am thrilled to apply.";

  it('finds what reads as AI', () => {
    const tells = aiTells(ai);
    expect(tells.length).toBeGreaterThanOrEqual(5);
    expect(tells.join(' ')).toMatch(/leverage/);
    expect(tells.join(' ')).toMatch(/dashes/);
  });

  it('leaves a plain, human answer alone', () => {
    const human = 'I built the payments API at my current job in Node.js and NestJS, and moved it from a single server to AWS Lambda last year.';
    expect(aiTells(human)).toEqual([]);
    expect(plainWords(human)).toBe(human);
  });

  it('swaps AI words for plain ones and keeps one dash', () => {
    const out = plainWords(ai);
    expect(out).toMatch(/I use reliable Node\.js skills/);
    expect(out).toMatch(/I led smooth migrations/);
    expect((out.match(/—/g) ?? []).length).toBe(1);
    expect(aiTells(out).length).toBeLessThan(aiTells(ai).length);
  });

  it('checks only written answers, not a number, a city or a short phrase', () => {
    expect(isWrittenAnswer('5')).toBe(false);
    expect(isWrittenAnswer('Noida, Uttar Pradesh')).toBe(false);
    expect(isWrittenAnswer(ai)).toBe(true);
  });
});
