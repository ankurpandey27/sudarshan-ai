// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { TasteModel } from '../interfaces/taste.interface';

export interface Sample {
  x: Record<string, number>;
  y: 0 | 1;
}

const sigmoid = (z: number): number => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));

/** Plain logistic regression by gradient descent: small data, no library, fully explainable. */
export function trainLogistic(samples: Sample[], opts: { steps: number; rate: number; l2: number }): TasteModel {
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

export function predictLogistic(m: TasteModel, x: Record<string, number>): number {
  let z = m.bias;
  for (const [k, v] of Object.entries(x)) z += (m.weights[k] ?? 0) * v;
  return sigmoid(z);
}

/** Each feature's push on this prediction, strongest first. */
export function contributions(m: TasteModel, x: Record<string, number>): { feature: string; value: number }[] {
  return Object.entries(x)
    .map(([k, v]) => ({ feature: k, value: (m.weights[k] ?? 0) * v }))
    .filter((c) => Math.abs(c.value) > 0.05)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}
