// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { LOGISTIC } from '../constants/learners.constants';
import { LearnerMode } from '../enums/learner-mode.enum';
import { knnVote } from './knn.util';
import { auc, predictLogistic, trainLogistic } from './logistic.util';
import { decideMode, metricsOf } from './mode.util';
import { outcomeFeatures } from './outcome-features.util';
import { pairFeatures, sameReply } from './pair-features.util';

const v = (...xs: number[]) => {
  const n = Math.hypot(...xs) || 1;
  return Float32Array.from(xs.map((x) => x / n));
};

describe('learner building blocks', () => {
  it('logistic regression learns a simple rule and ranks by it', () => {
    const samples = Array.from({ length: 40 }, (_, i) => ({ x: { signal: i % 2 }, y: (i % 2) as 0 | 1 }));
    const m = trainLogistic(samples, LOGISTIC);
    expect(predictLogistic(m, { signal: 1 })).toBeGreaterThan(0.8);
    expect(predictLogistic(m, { signal: 0 })).toBeLessThan(0.2);
    expect(
      auc([
        { y: 1, p: 0.9 },
        { y: 0, p: 0.1 },
        { y: 1, p: 0.7 },
        { y: 0, p: 0.8 },
      ]),
    ).toBe(0.75);
  });

  it('nearest examples vote, weighted by how often each was seen', () => {
    const ex = [
      { text: 'Phone number', label: 'phone', vector: v(1, 0), weight: 5 },
      { text: 'Mobile', label: 'phone', vector: v(0.95, 0.1), weight: 1 },
      { text: 'Email', label: 'email', vector: v(0, 1), weight: 3 },
    ];
    const vote = knnVote(v(0.98, 0.05), ex, 3)!;
    expect(vote.label).toBe('phone');
    expect(vote.agreement).toBeGreaterThan(0.8);
    expect(vote.nearest).toBe('Phone number');
    // The example being tested is left out of its own vote.
    expect(knnVote(v(1, 0), ex, 1, (e) => e.text === 'Phone number')!.nearest).toBe('Mobile');
  });

  it('acts only when proven, and goes back to checking when it slips', () => {
    const good = metricsOf(30, 29, 'held out');
    const weak = metricsOf(30, 25, 'held out');
    const base = { enabled: true, examples: 100, min: 40, live: null };
    expect(decideMode({ ...base, offline: good })).toBe(LearnerMode.ON);
    expect(decideMode({ ...base, offline: weak })).toBe(LearnerMode.CHECKING);
    expect(decideMode({ ...base, offline: metricsOf(10, 10, 'few') })).toBe(LearnerMode.CHECKING);
    expect(decideMode({ ...base, examples: 10, offline: good })).toBe(LearnerMode.LEARNING);
    expect(decideMode({ ...base, enabled: false, offline: good })).toBe(LearnerMode.OFF);
    // Proven at training, but live checks are going wrong: back to checking.
    expect(decideMode({ ...base, offline: good, live: metricsOf(20, 15, 'live') })).toBe(LearnerMode.CHECKING);
  });

  it('sees what makes similar questions different', () => {
    const f = pairFeatures('Current CTC (annual, INR)', 'Expected CTC (annual, INR)', 0.95);
    expect(f['meaning flips']).toBeGreaterThan(0);
    expect(pairFeatures('What is your notice period?', 'Notice period (days)', 0.8)['meaning flips']).toBeGreaterThan(0);
    expect(pairFeatures('React experience (years)', 'Years of React experience', 0.9)['same subject']).toBe(1);
    // One asks about Next.js too: not the same subject both ways.
    expect(pairFeatures('React experience (years)', 'React / Next.js experience (years)', 0.9)['same subject']).toBe(0);
    expect(sameReply('30', '30 days')).toBe(true);
    expect(sameReply('12', '18')).toBe(false);
    // Yes and No say nothing about whether two questions are the same.
    expect(sameReply('Yes', 'Yes')).toBeNull();
  });

  it('describes an attempt: platform, company site, how that site went before', () => {
    const hosts = new Map([['careers.acme.com', { ok: 0, n: 6 }]]);
    const f = outcomeFeatures({ platform: 'linkedin', easyApply: false, host: 'careers.acme.com', external: true, score: 80 }, hosts);
    expect(f['platform: linkedin']).toBe(1);
    expect(f['company site']).toBe(1);
    expect(f['site success rate']).toBeCloseTo(1 / 8);
    // A site never tried starts at even odds.
    expect(outcomeFeatures({ platform: 'naukri', easyApply: true, host: 'new.example', external: false, score: null }, hosts)['site success rate']).toBe(0.5);
  });
});
