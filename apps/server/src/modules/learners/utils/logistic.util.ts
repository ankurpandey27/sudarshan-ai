// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { LogisticModel, LogisticSample } from '../interfaces/logistic-model.interface';

const sigmoid = (z: number): number => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));

/** Plain logistic regression by gradient descent: small data, no library, fully explainable. */
export function trainLogistic(samples: LogisticSample[], opts: { steps: number; rate: number; l2: number }): LogisticModel {
  const weights: Record<string, number> = {};
  for (const s of samples) for (const k of Object.keys(s.x)) weights[k] ??= 0;
  // Start from the base rate so an unbalanced history does not dominate early steps.
  const rate1 = samples.filter((s) => s.y === 1).length / Math.max(1, samples.length);
  let bias = Math.log((rate1 + 1e-3) / (1 - rate1 + 1e-3));
  const n = Math.max(1, samples.length);
  for (let step = 0; step < opts.steps; step++) {
    const grad: Record<string, number> = {};
    let gBias = 0;
    for (const s of samples) {
      const err = predictLogistic({ weights, bias }, s.x) - s.y;
      gBias += err;
      for (const [k, v] of Object.entries(s.x)) grad[k] = (grad[k] ?? 0) + err * v;
    }
    bias -= (opts.rate * gBias) / n;
    for (const k of Object.keys(weights)) weights[k] -= opts.rate * ((grad[k] ?? 0) / n + opts.l2 * weights[k]);
  }
  return { weights, bias };
}

export function predictLogistic(m: LogisticModel, x: Record<string, number>): number {
  let z = m.bias;
  for (const [k, v] of Object.entries(x)) z += (m.weights[k] ?? 0) * v;
  return sigmoid(z);
}

/** Chance a random positive scores above a random negative (0.5 = coin toss, 1 = perfect). */
export function auc(scored: { y: 0 | 1; p: number }[]): number | null {
  const pos = scored.filter((s) => s.y === 1);
  const neg = scored.filter((s) => s.y === 0);
  if (!pos.length || !neg.length) return null;
  let w = 0;
  for (const a of pos) for (const b of neg) w += a.p > b.p ? 1 : a.p === b.p ? 0.5 : 0;
  return w / (pos.length * neg.length);
}
